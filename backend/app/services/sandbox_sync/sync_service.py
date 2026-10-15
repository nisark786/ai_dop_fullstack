"""AWS RDS Sandbox database synchronization service.

Handles upsert (update-or-insert) operations into `public.schools` on AWS RDS
Sandbox without crashing local promotion workflows on network/database failure.
"""

import json
import logging
import uuid
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.services.sandbox_sync.normalizer import build_sandbox_payload
from app.services.sandbox_sync.sandbox_client import get_sandbox_engine

logger = logging.getLogger(__name__)


@dataclass
class SandboxSyncResult:
    status: str  # "synced", "failed", "disabled"
    sandbox_id: str | None = None
    message: str | None = None
    error: str | None = None
    synced_at: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class SandboxSyncService:
    """Orchestrates syncing verified school records to AWS RDS Sandbox."""

    @classmethod
    def sync_school(
        cls,
        school_data: dict[str, Any],
        match_name: str | None = None,
        existing_sandbox_id: str | None = None,
        engine: Engine | None = None,
    ) -> SandboxSyncResult:
        """Synchronize a single verified school record into the Sandbox `public.schools` table.

        - Strictly updates/inserts active core fields.
        - Leaves learning_models, extracurricular_programs, open_enrollment, and full_address untouched.
        - Catches all exceptions and returns a structured SandboxSyncResult.
        """
        payload = build_sandbox_payload(school_data)
        school_name = payload.get("name") or match_name
        if not school_name:
            return SandboxSyncResult(
                status="failed",
                error="Cannot sync to Sandbox: school name is missing.",
                synced_at=datetime.now(UTC).isoformat(),
            )

        active_engine = engine or get_sandbox_engine()
        if not active_engine:
            return SandboxSyncResult(
                status="disabled",
                message="Sandbox sync is disabled or connection parameters are unconfigured.",
                synced_at=datetime.now(UTC).isoformat(),
            )

        try:
            with active_engine.connect() as conn:
                matched_id: str | None = None

                # 1. Match by existing UUID if provided
                if existing_sandbox_id:
                    try:
                        valid_uuid = str(uuid.UUID(str(existing_sandbox_id)))
                        chk = conn.execute(
                            text("SELECT id FROM public.schools WHERE id = :id LIMIT 1;"),
                            {"id": valid_uuid},
                        ).fetchone()
                        if chk:
                            matched_id = str(chk[0])
                    except (ValueError, TypeError):
                        pass

                # 2. Match by case-insensitive name if not matched by UUID
                if not matched_id and school_name:
                    chk = conn.execute(
                        text(
                            "SELECT id FROM public.schools WHERE LOWER(name) = LOWER(:name) LIMIT 1;"
                        ),
                        {"name": school_name.strip()},
                    ).fetchone()
                    if chk:
                        matched_id = str(chk[0])

                now_iso = datetime.now(UTC).isoformat()

                # Prepare parameterized values
                params: dict[str, Any] = {
                    "name": school_name.strip(),
                    "website": payload.get("website"),
                    "address": payload.get("address"),
                    "phone": payload.get("phone"),
                    "email": payload.get("email"),
                    "description": payload.get("description"),
                    "type_json": json.dumps(payload.get("type", ["private"])),
                    "grades_json": json.dumps(payload.get("grades", [])),
                    "is_active": True,
                }

                if matched_id:
                    # Update existing record
                    params["id"] = matched_id
                    update_sql = text("""
                        UPDATE public.schools
                        SET name = :name,
                            website = COALESCE(:website, website),
                            address = COALESCE(:address, address),
                            phone = COALESCE(:phone, phone),
                            email = COALESCE(:email, email),
                            description = COALESCE(:description, description),
                            type = :type_json::jsonb,
                            grades = :grades_json::jsonb,
                            is_active = :is_active,
                            updated_at = NOW()
                        WHERE id = :id;
                    """)
                    conn.execute(update_sql, params)
                    conn.commit()
                    logger.info(
                        "Successfully updated school '%s' in Sandbox (ID: %s)",
                        school_name,
                        matched_id,
                    )
                    return SandboxSyncResult(
                        status="synced",
                        sandbox_id=matched_id,
                        message=f"Updated school '{school_name}' in Sandbox.",
                        synced_at=now_iso,
                    )
                else:
                    # Insert new record (letting PostgreSQL generate native UUID via uuid_generate_v4())
                    insert_sql = text("""
                        INSERT INTO public.schools (
                            name, website, address, phone, email, description,
                            type, grades, is_active, created_at, updated_at
                        ) VALUES (
                            :name, :website, :address, :phone, :email, :description,
                            :type_json::jsonb, :grades_json::jsonb, :is_active, NOW(), NOW()
                        )
                        RETURNING id;
                    """)
                    result = conn.execute(insert_sql, params)
                    inserted_row = result.fetchone()
                    conn.commit()
                    new_id = str(inserted_row[0]) if inserted_row else None
                    logger.info(
                        "Successfully inserted school '%s' into Sandbox (ID: %s)",
                        school_name,
                        new_id,
                    )
                    return SandboxSyncResult(
                        status="synced",
                        sandbox_id=new_id,
                        message=f"Inserted new school '{school_name}' into Sandbox.",
                        synced_at=now_iso,
                    )

        except Exception as e:
            logger.error("Error synchronizing school '%s' to Sandbox: %s", school_name, e)
            return SandboxSyncResult(
                status="failed",
                error=str(e),
                synced_at=datetime.now(UTC).isoformat(),
            )

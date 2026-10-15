import logging
from contextlib import suppress
from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.database import get_database_session
from app.models.batch import BatchModel, BatchSchoolModel
from app.models.metadata_output import MetadataAgentOutputModel
from app.models.pipeline import EvidenceRecordModel
from app.models.schools import Schools
from app.models.staging_school import StagingSchoolModel
from app.schemas.review import (
    BulkReviewActionRequest,
    BulkReviewActionResponse,
    ConfidenceComponentsResponse,
    EvidenceCandidateResponse,
    ResolvedValueResponse,
    ReviewActionResponse,
    ReviewCorrectRequest,
    ReviewEvidenceItem,
    SandboxSyncInfoSchema,
    SandboxSyncStatusResponse,
    ValueGroupResponse,
    VerificationSchoolItem,
)
from app.services.promotion.school_promotion_service import SchoolPromotionService
from app.services.sandbox_sync.sync_service import SandboxSyncService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/review", tags=["Review Queue"])


def _calculate_routing_band(confidence: float) -> str:
    """Calculates decision routing band per specification."""
    if confidence >= 0.95:
        return "Auto Publish"
    if confidence >= 0.85:
        return "Reviewer Approval"
    if confidence >= 0.70:
        return "Mandatory HITL Review"
    return "Escalation Required"


def _format_value_display(val: any) -> str:
    """Formats values for human-readable display in the review queue."""
    if val is None:
        return ""
    if isinstance(val, list):
        return ", ".join(str(x) for x in val)
    if isinstance(val, bool):
        return "Yes" if val else "No"
    return str(val).strip()


@router.get(
    "",
    response_model=list[ResolvedValueResponse],
    summary="Fetch pending HITL review queue items",
)
def get_review_queue(db: Session = Depends(get_database_session)) -> list[ResolvedValueResponse]:
    """
    Fetches all pending audit recommendations from metadata_agent_outputs and evidence_records.
    """
    outputs = (
        db.query(MetadataAgentOutputModel)
        .filter(
            MetadataAgentOutputModel.applied_to_school == False,
            MetadataAgentOutputModel.verification_status.in_(
                ["needs_review", "pending", "invalid"]
            ),
        )
        .order_by(MetadataAgentOutputModel.created_at.desc())
        .all()
    )

    results: list[ResolvedValueResponse] = []
    if not outputs:
        return results

    # 1. Collect unique staging and production school IDs
    staging_ids = [o.staging_school_id for o in outputs if o.staging_school_id]
    prod_ids = [o.school_id for o in outputs if o.school_id]

    # 2. Batch prefetch staging and production schools
    staging_map = (
        {
            s.id: s
            for s in db.query(StagingSchoolModel)
            .filter(StagingSchoolModel.id.in_(staging_ids), StagingSchoolModel.deleted_at.is_(None))
            .all()
        }
        if staging_ids
        else {}
    )

    prod_map = (
        {
            s.id: s
            for s in db.query(Schools)
            .filter(Schools.id.in_(prod_ids), Schools.deleted_at.is_(None))
            .all()
        }
        if prod_ids
        else {}
    )

    # 3. Batch prefetch latest output per school to check for newer verified runs
    school_filter_conditions = []
    if staging_ids:
        school_filter_conditions.append(MetadataAgentOutputModel.staging_school_id.in_(staging_ids))
    if prod_ids:
        school_filter_conditions.append(MetadataAgentOutputModel.school_id.in_(prod_ids))

    latest_by_school: dict[str, MetadataAgentOutputModel] = {}
    if school_filter_conditions:
        candidate_outputs = (
            db.query(MetadataAgentOutputModel)
            .filter(or_(*school_filter_conditions))
            .order_by(MetadataAgentOutputModel.created_at.desc())
            .all()
        )
        for lo in candidate_outputs:
            s_key = str(lo.staging_school_id or lo.school_id or "")
            if s_key and s_key not in latest_by_school:
                latest_by_school[s_key] = lo

    # 4. Batch prefetch all evidence records for target schools
    evidence_filter_conditions = []
    if staging_ids:
        evidence_filter_conditions.append(EvidenceRecordModel.staging_school_id.in_(staging_ids))
    if prod_ids:
        evidence_filter_conditions.append(EvidenceRecordModel.school_id.in_(prod_ids))

    evidence_map: dict[tuple[str, str], list[EvidenceRecordModel]] = {}
    if evidence_filter_conditions:
        all_evidences = db.query(EvidenceRecordModel).filter(or_(*evidence_filter_conditions)).all()
        for ev in all_evidences:
            ev_target_key = str(ev.staging_school_id or ev.school_id or "")
            key = (ev_target_key, ev.field_name)
            if key not in evidence_map:
                evidence_map[key] = []
            evidence_map[key].append(ev)

    seen_schools: set[str] = set()

    for o in outputs:
        # Determine unique school identifier and ensure we only take the latest run per school
        target_school_key = str(o.staging_school_id or o.school_id or "")
        if not target_school_key or target_school_key in seen_schools:
            continue

        # Check precomputed latest output for this school
        latest_output = latest_by_school.get(target_school_key)

        # If a newer run exists, or if the latest run is already verified/applied, skip this record
        if latest_output and latest_output.id != o.id:
            continue
        if latest_output and (
            latest_output.verification_status == "verified" or latest_output.applied_to_school
        ):
            continue

        seen_schools.add(target_school_key)

        entity = staging_map.get(o.staging_school_id) or prod_map.get(o.school_id)
        if not entity:
            continue

        recs = o.recommendations or []
        for rec in recs:
            rec_field = rec.get("field")
            recommended_val = rec.get("recommended")
            if not rec_field or recommended_val is None:
                continue

            recommended_str = _format_value_display(recommended_val)
            if not recommended_str:
                continue

            # Current database value
            current_raw = getattr(entity, rec_field, None)
            current_str = (
                _format_value_display(current_raw)
                if current_raw is not None
                else _format_value_display(rec.get("current"))
            )

            # Confidence score and routing band
            conf_val = float(rec.get("confidence", 0.75))
            confidence_pct = round(conf_val * 100.0, 1) if conf_val <= 1.0 else round(conf_val, 1)
            routing_band = _calculate_routing_band(
                conf_val if conf_val <= 1.0 else conf_val / 100.0
            )

            # Retrieve pre-fetched matching evidence citations
            evidences = evidence_map.get((target_school_key, rec_field), [])

            candidates: list[EvidenceCandidateResponse] = []
            for ev in evidences:
                ext_val = _format_value_display(ev.raw_value) or recommended_str
                time_str = (
                    ev.extracted_at.strftime("%Y-%m-%d %H:%M") if ev.extracted_at else "Recent"
                )
                score = (
                    round(ev.confidence_score * 100.0, 1)
                    if ev.confidence_score <= 1.0
                    else round(ev.confidence_score, 1)
                )
                candidates.append(
                    EvidenceCandidateResponse(
                        id=str(ev.id),
                        source_name=ev.source_name or "Official School Website",
                        source_type=ev.source_type or "Official Portal",
                        source_category=ev.source_tier or "Cat 1 — Official School",
                        extracted_value=ext_val,
                        field_value=ext_val,
                        confidence_score=score,
                        citation_url=ev.source_url,
                        source_url=ev.source_url,
                        raw_extracted_text=ev.raw_extracted_text,
                        retrieval_timestamp=time_str,
                        crawl_timestamp=time_str,
                        trust_weight=100.0,
                        historical_accuracy=score,
                        source_score=score,
                    )
                )

            # Fallback to recommendation sources if evidence_records is empty for this field
            if not candidates:
                for idx, src in enumerate(rec.get("sources", [])):
                    src_url = (
                        src.get("url") or getattr(entity, "website", None) or "https://school.edu"
                    )
                    candidates.append(
                        EvidenceCandidateResponse(
                            id=f"SRC-{o.id}-{rec_field}-{idx}",
                            source_name=src.get("page") or "Official School Website",
                            source_type="Official Portal",
                            source_category="Cat 1 — Official School",
                            extracted_value=recommended_str,
                            field_value=recommended_str,
                            confidence_score=confidence_pct,
                            citation_url=src_url,
                            source_url=src_url,
                            raw_extracted_text=src.get("text") or rec.get("reason"),
                            retrieval_timestamp="Recent",
                            crawl_timestamp="Recent",
                            trust_weight=round(float(src.get("trust_score", 0.95)) * 100.0, 1),
                            historical_accuracy=confidence_pct,
                            source_score=confidence_pct,
                        )
                    )

            # Group candidates for MatchmakingPanel
            val_groups: dict[str, dict] = {}
            for c in candidates:
                val = c.extracted_value
                if val not in val_groups:
                    val_groups[val] = {"count": 0, "evidence_ids": [], "support": 0.0}
                val_groups[val]["count"] += 1
                val_groups[val]["evidence_ids"].append(c.id)
                val_groups[val]["support"] += c.confidence_score

            groups_list = [
                ValueGroupResponse(
                    normalized_value=k,
                    candidate_count=v["count"],
                    source_diversity=v["count"],
                    weighted_score=round(v["support"] / max(v["count"], 1), 1),
                    is_winning=(k == recommended_str),
                    evidence_ids=v["evidence_ids"],
                )
                for k, v in val_groups.items()
            ]

            if not groups_list:
                groups_list.append(
                    ValueGroupResponse(
                        normalized_value=recommended_str,
                        candidate_count=1,
                        source_diversity=1,
                        weighted_score=confidence_pct,
                        is_winning=True,
                        evidence_ids=[],
                    )
                )

            item_id = f"{o.id}:{rec_field}"

            results.append(
                ResolvedValueResponse(
                    id=item_id,
                    school_id=str(entity.id),
                    school_name=entity.name,
                    product="School Profile & Metadata",
                    product_name="School Profile & Metadata",
                    field_name=rec_field,
                    academic_year="2024-2025",
                    previous_value=current_str or None,
                    winning_value=recommended_str,
                    final_value=None,
                    confidence=confidence_pct,
                    composite_confidence=confidence_pct,
                    confidence_components=ConfidenceComponentsResponse(
                        support_strength=confidence_pct,
                        source_agreement=min(confidence_pct + 5.0, 100.0),
                        freshness=95.0,
                        historical_consistency=90.0,
                    ),
                    decision=routing_band,
                    routing_band=routing_band,
                    review_status="pending",
                    has_conflict=bool(current_str and current_str != recommended_str),
                    total_support=1.0,
                    dqa_score=int(o.overall_score) if o.overall_score is not None else None,
                    value_groups=groups_list,
                    evidence_candidates=candidates,
                )
            )

    return results


def _apply_field_to_entity(
    entity: Schools | StagingSchoolModel, field_name: str, value: any
) -> None:
    """Safely updates a school or staging school attribute with type coercion."""
    if field_name == "name":
        entity.name = str(value)
    elif field_name == "phone":
        entity.phone = str(value)
    elif field_name == "email":
        entity.email = str(value)
    elif field_name == "website":
        entity.website = str(value)
    elif field_name == "address":
        entity.address = str(value)
    elif field_name in ("grades", "type"):
        if isinstance(value, list):
            setattr(entity, field_name, value)
        elif isinstance(value, str):
            setattr(entity, field_name, [x.strip() for x in value.split(",") if x.strip()])
    else:
        if hasattr(entity, field_name):
            if field_name == "open_enrollment":
                setattr(entity, field_name, value in (True, "True", "true", "Yes", "yes", 1))
            elif isinstance(value, list):
                setattr(entity, field_name, value)
            else:
                setattr(entity, field_name, str(value))
        elif isinstance(entity, StagingSchoolModel):
            meta = dict(entity.metadata_json or {})
            prods = dict(meta.get("products") or {})
            info_prod = dict(prods.get("info") or {})
            extracted = dict(info_prod.get("extracted_fields") or {})
            extracted[field_name] = value
            info_prod["extracted_fields"] = extracted
            prods["info"] = info_prod
            meta["products"] = prods
            entity.metadata_json = meta


@router.post(
    "/{id}/approve",
    response_model=ReviewActionResponse,
    summary="Approve review item and write to master catalog",
)
def approve_review_item(
    id: str,
    db: Session = Depends(get_database_session),
) -> ReviewActionResponse:
    """Applies recommended value to the master school or staging record and updates verification status."""
    output_id_str, field_name = id.split(":", 1) if ":" in id else (id, None)

    try:
        output_uuid = UUID(output_id_str)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid output ID '{output_id_str}'"
        ) from err

    output = (
        db.query(MetadataAgentOutputModel)
        .filter(MetadataAgentOutputModel.id == output_uuid)
        .first()
    )
    if not output:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Output record '{output_id_str}' not found",
        )

    staging_school: StagingSchoolModel | None = None
    school: Schools | None = None
    if output.staging_school_id:
        staging_school = (
            db.query(StagingSchoolModel)
            .filter(StagingSchoolModel.id == output.staging_school_id)
            .first()
        )
    if output.school_id:
        school = db.query(Schools).filter(Schools.id == output.school_id).first()

    entity = staging_school or school
    if not entity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Associated school entity not found"
        )
    if staging_school and staging_school.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Cannot approve output for a school that has been dropped or trashed.",
        )

    for rec in output.recommendations or []:
        if field_name is None or rec.get("field") == field_name:
            val = rec.get("recommended")
            if val is not None:
                _apply_field_to_entity(entity, rec.get("field"), val)

    if staging_school:
        staging_school.status = "verified"
        meta = dict(staging_school.metadata_json or {})
        prods = dict(meta.get("products") or {})
        if "info" in prods:
            info_prod = dict(prods["info"])
            info_prod["status"] = "verified"
            prods["info"] = info_prod
        meta["products"] = prods
        staging_school.metadata_json = meta
        staging_school.updated_at = datetime.utcnow()

    if school:
        school.is_active = True
        school.profile_verification_status = "verified"
        school.profile_verified_at = datetime.now(UTC)
        school.updated_at = datetime.now(UTC)

    if output.batch_id and school:
        bs = (
            db.query(BatchSchoolModel)
            .filter(
                BatchSchoolModel.batch_id == output.batch_id,
                BatchSchoolModel.school_id == school.id,
            )
            .first()
        )
        if bs:
            bs.status = "verified"
            meta = dict(bs.metadata_json or {})
            prods = dict(meta.get("products") or {})
            if "info" in prods:
                prods["info"]["status"] = "verified"
            meta["products"] = prods
            bs.metadata_json = meta

    output.applied_to_school = True
    output.verification_status = "verified"

    db.commit()

    return ReviewActionResponse(
        record_id=id,
        action="approved",
        status="approved",
        message=f"Approved and applied '{field_name or 'all fields'}' for {entity.name}. Record marked Verified.",
    )


@router.post(
    "/{id}/correct",
    response_model=ReviewActionResponse,
    summary="Submit manual correction and write to master catalog",
)
def correct_review_item(
    id: str,
    payload: ReviewCorrectRequest,
    db: Session = Depends(get_database_session),
) -> ReviewActionResponse:
    """Applies human-corrected value to the master school or staging record and updates verification status."""
    output_id_str, field_name = id.split(":", 1) if ":" in id else (id, "name")

    try:
        output_uuid = UUID(output_id_str)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid output ID '{output_id_str}'"
        ) from err

    output = (
        db.query(MetadataAgentOutputModel)
        .filter(MetadataAgentOutputModel.id == output_uuid)
        .first()
    )
    if not output:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Output record '{output_id_str}' not found",
        )

    staging_school: StagingSchoolModel | None = None
    school: Schools | None = None
    if output.staging_school_id:
        staging_school = (
            db.query(StagingSchoolModel)
            .filter(StagingSchoolModel.id == output.staging_school_id)
            .first()
        )
    if output.school_id:
        school = db.query(Schools).filter(Schools.id == output.school_id).first()

    entity = staging_school or school
    if not entity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Associated school entity not found"
        )
    if staging_school and staging_school.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Cannot modify an output for a school that has been dropped or trashed.",
        )

    # Apply manual correction
    _apply_field_to_entity(entity, field_name, payload.corrected_value)

    if staging_school:
        staging_school.status = "verified"
        meta = dict(staging_school.metadata_json or {})
        prods = dict(meta.get("products") or {})
        if "info" in prods:
            info_prod = dict(prods["info"])
            info_prod["status"] = "verified"
            prods["info"] = info_prod
        meta["products"] = prods
        staging_school.metadata_json = meta
        staging_school.updated_at = datetime.utcnow()

    if school:
        school.is_active = True
        school.profile_verification_status = "verified"
        school.profile_verified_at = datetime.now(UTC)
        school.updated_at = datetime.now(UTC)

    if output.batch_id and school:
        bs = (
            db.query(BatchSchoolModel)
            .filter(
                BatchSchoolModel.batch_id == output.batch_id,
                BatchSchoolModel.school_id == school.id,
            )
            .first()
        )
        if bs:
            bs.status = "verified"
            meta = dict(bs.metadata_json or {})
            prods = dict(meta.get("products") or {})
            if "info" in prods:
                prods["info"]["status"] = "verified"
            meta["products"] = prods
            bs.metadata_json = meta

    output.applied_to_school = True
    output.verification_status = "verified"

    db.commit()

    return ReviewActionResponse(
        record_id=id,
        action="corrected",
        status="corrected",
        message=f"Corrected '{field_name}' to '{payload.corrected_value}' for {entity.name}. Record marked Verified.",
    )


@router.post(
    "/{id}/reject",
    response_model=ReviewActionResponse,
    summary="Reject review item",
)
def reject_review_item(
    id: str,
    db: Session = Depends(get_database_session),
) -> ReviewActionResponse:
    """Dismisses recommendation while preserving the audit trail."""
    output_id_str, field_name = id.split(":", 1) if ":" in id else (id, None)

    try:
        output_uuid = UUID(output_id_str)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid output ID '{output_id_str}'"
        ) from err

    output = (
        db.query(MetadataAgentOutputModel)
        .filter(MetadataAgentOutputModel.id == output_uuid)
        .first()
    )
    if output:
        output.verification_status = "rejected"
        db.commit()

    return ReviewActionResponse(
        record_id=id,
        action="rejected",
        status="rejected",
        message=f"Rejected recommendation for '{field_name or 'item'}'. Audit record retained.",
    )


@router.get(
    "/schools",
    response_model=list[VerificationSchoolItem],
    summary="Fetch schools for Verification Queue, Approved Schools, or Re-crawl Queue",
)
def get_review_schools(
    batch_id: str | None = None,
    product: str = "info",
    queue_type: str = "verification",
    search: str | None = None,
    db: Session = Depends(get_database_session),
) -> list[VerificationSchoolItem]:
    """Returns schools partitioned by queue type:

    - 'verification': All unverified crawled/intake schools awaiting human approval
    - 'approved': Verified/published schools
    - 'recrawl': Rejected schools requiring re-crawl or agent re-execution
    """
    batches_map = {str(b.id): b.name for b in db.query(BatchModel).all()}

    query = db.query(StagingSchoolModel).filter(StagingSchoolModel.deleted_at.is_(None))

    if batch_id and batch_id.lower() not in {"all", ""}:
        with suppress(ValueError):
            b_uuid = UUID(batch_id)
            query = query.filter(StagingSchoolModel.batch_id == b_uuid)

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            (StagingSchoolModel.name.ilike(term)) | (StagingSchoolModel.district.ilike(term))
        )

    # Queue partitioning logic
    if queue_type == "approved":
        query = query.filter(StagingSchoolModel.status == "approved")
    elif queue_type == "recrawl":
        query = query.filter(StagingSchoolModel.status.in_(["rejected", "needs_recrawl"]))
    else:  # 'verification'
        query = query.filter(
            ~StagingSchoolModel.status.in_(["approved", "published", "rejected", "needs_recrawl"])
        )

    stagings = query.order_by(StagingSchoolModel.created_at.desc()).all()
    results: list[VerificationSchoolItem] = []

    for st in stagings:
        output = (
            db.query(MetadataAgentOutputModel)
            .filter(MetadataAgentOutputModel.staging_school_id == st.id)
            .order_by(MetadataAgentOutputModel.created_at.desc())
            .first()
        )

        evidences = (
            db.query(EvidenceRecordModel)
            .filter(EvidenceRecordModel.staging_school_id == st.id)
            .order_by(EvidenceRecordModel.extracted_at.desc())
            .all()
        )

        evidence_items: list[ReviewEvidenceItem] = []
        for ev in evidences:
            score = (
                round(ev.confidence_score * 100.0, 1)
                if ev.confidence_score is not None and ev.confidence_score <= 1.0
                else (round(ev.confidence_score, 1) if ev.confidence_score is not None else 85.0)
            )
            time_str = ev.extracted_at.strftime("%Y-%m-%d %H:%M") if ev.extracted_at else None
            evidence_items.append(
                ReviewEvidenceItem(
                    id=str(ev.id),
                    field_name=ev.field_name or "general",
                    source_name=ev.source_name or "Official School Website",
                    source_type=ev.source_type or "Official Portal",
                    source_url=ev.source_url or "",
                    snippet=ev.raw_extracted_text or _format_value_display(ev.raw_value),
                    extracted_value=_format_value_display(ev.raw_value),
                    confidence_score=score,
                    extracted_at=time_str,
                )
            )

        extracted: dict[str, str | list[str] | None] = {
            "name": st.name,
            "website": st.website,
            "district": st.district,
            "state": st.state,
            "phone": st.phone,
            "email": st.email,
            "address": st.address,
            "grades": st.grades or [],
            "type": st.type or [],
        }

        recs: list[dict[str, str | float | None]] = []
        if output and output.recommendations:
            for r in output.recommendations:
                conf = float(r.get("confidence", 0.75))
                conf_pct = round(conf * 100.0, 1) if conf <= 1.0 else round(conf, 1)
                recs.append(
                    {
                        "field": r.get("field"),
                        "current": _format_value_display(r.get("current")),
                        "recommended": _format_value_display(r.get("recommended")),
                        "confidence": conf_pct,
                        "reason": r.get("reason"),
                    }
                )
                fld = r.get("field")
                if fld and r.get("recommended") is not None:
                    extracted[fld] = _format_value_display(r.get("recommended"))

        dqa = int(output.overall_score) if output and output.overall_score is not None else None

        if recs:
            avg_conf = round(sum(float(r["confidence"] or 0) for r in recs) / len(recs), 1)
        elif evidence_items:
            avg_conf = round(
                sum(e.confidence_score for e in evidence_items) / len(evidence_items), 1
            )
        else:
            avg_conf = 85.0 if st.status in ["verified", "published"] else None

        updated_str = st.updated_at.strftime("%Y-%m-%d %H:%M") if st.updated_at else None

        sync_meta = (st.metadata_json or {}).get("sandbox_sync")
        sandbox_sync_obj = None
        if isinstance(sync_meta, dict) and "status" in sync_meta:
            sandbox_sync_obj = SandboxSyncInfoSchema(
                status=sync_meta.get("status", "disabled"),
                sandbox_id=sync_meta.get("sandbox_id"),
                synced_at=sync_meta.get("synced_at"),
                message=sync_meta.get("message"),
                error=sync_meta.get("error"),
            )

        results.append(
            VerificationSchoolItem(
                id=str(st.id),
                batch_id=str(st.batch_id),
                batch_name=batches_map.get(str(st.batch_id), "Standard Batch"),
                name=st.name,
                website=st.website,
                district=st.district,
                state=st.state,
                phone=st.phone,
                email=st.email,
                address=st.address,
                type=st.type or [],
                grades=st.grades or [],
                status=st.status,
                dqa_score=dqa,
                confidence_score=avg_conf,
                evidence_count=len(evidence_items),
                extracted_fields=extracted,
                recommendations=recs,
                evidences=evidence_items,
                is_published=bool(st.production_school_id or st.status == "published"),
                production_school_id=str(st.production_school_id)
                if st.production_school_id
                else None,
                updated_at=updated_str,
                sandbox_sync=sandbox_sync_obj,
            )
        )

    return results


@router.post(
    "/bulk-action",
    response_model=BulkReviewActionResponse,
    summary="Execute bulk Approve, Reject, or Undo on schools",
)
def execute_bulk_review_action(
    payload: BulkReviewActionRequest,
    db: Session = Depends(get_database_session),
) -> BulkReviewActionResponse:
    """Applies review actions (approve, reject, undo) across single, group, or batch scope.

    - approve: moves to 'verified' -> appears in Approved Schools
    - reject: moves to 'rejected' -> appears in Re-crawl Queue
    - undo: reverts to 'needs_verification' -> returns immediately to Verification Queue
    """
    target_uuids: list[UUID] = []

    if payload.scope == "batch" and payload.batch_id:
        try:
            b_uuid = UUID(payload.batch_id)
        except ValueError as err:
            raise HTTPException(
                status_code=400, detail=f"Invalid batch UUID '{payload.batch_id}'"
            ) from err

        batch_schools = db.query(StagingSchoolModel).filter(
            StagingSchoolModel.batch_id == b_uuid, StagingSchoolModel.deleted_at.is_(None)
        )
        if payload.action == "approve":
            batch_schools = batch_schools.filter(
                ~StagingSchoolModel.status.in_(["approved", "published"])
            )
        elif payload.action == "publish":
            batch_schools = batch_schools.filter(StagingSchoolModel.status == "approved")
        elif payload.action == "reject":
            batch_schools = batch_schools.filter(
                ~StagingSchoolModel.status.in_(["rejected", "needs_recrawl"])
            )
        elif payload.action == "undo":
            batch_schools = batch_schools.filter(
                StagingSchoolModel.status.in_(
                    ["approved", "published", "rejected", "needs_recrawl"]
                )
            )

        target_uuids = [s.id for s in batch_schools.all()]
    else:
        for sid in payload.school_ids:
            with suppress(ValueError):
                target_uuids.append(UUID(sid))

    if not target_uuids:
        return BulkReviewActionResponse(
            action=payload.action,
            affected_count=0,
            message="No eligible schools found for this action.",
            updated_school_ids=[],
        )

    updated_ids: list[str] = []
    sandbox_synced_count = 0
    sandbox_failed_count = 0
    now = datetime.now(UTC)

    for s_uuid in target_uuids:
        staging = (
            db.query(StagingSchoolModel)
            .filter(StagingSchoolModel.id == s_uuid, StagingSchoolModel.deleted_at.is_(None))
            .first()
        )
        if not staging:
            continue

        output = (
            db.query(MetadataAgentOutputModel)
            .filter(MetadataAgentOutputModel.staging_school_id == staging.id)
            .order_by(MetadataAgentOutputModel.created_at.desc())
            .first()
        )

        meta = dict(staging.metadata_json or {})
        prods = dict(meta.get("products") or {})
        prod_data = dict(prods.get(payload.product) or {})

        if payload.action == "approve":
            staging.status = "approved"
            prod_data["status"] = "approved"
            meta["human_approved_at"] = now.isoformat()
            if output:
                output.verification_status = "verified"
                output.applied_to_school = True
                for rec in output.recommendations or []:
                    fld = rec.get("field")
                    val = rec.get("recommended")
                    if fld and val is not None:
                        _apply_field_to_entity(staging, fld, val)

        elif payload.action == "publish":
            try:
                SchoolPromotionService.promote_staging_school(db, staging.id)
                db.refresh(staging)
                meta = dict(staging.metadata_json or {})
                prods = dict(meta.get("products") or {})
                prod_data = dict(prods.get(payload.product) or {})

                sync_info = meta.get("sandbox_sync") or {}
                if sync_info.get("status") == "synced":
                    sandbox_synced_count += 1
                elif sync_info.get("status") == "failed":
                    sandbox_failed_count += 1
            except Exception as err:
                logger.error("Failed to promote staging school %s: %s", staging.id, err)
                continue
            staging.status = "published"
            prod_data["status"] = "published"
            meta["published_at"] = now.isoformat()

        elif payload.action == "reject":
            staging.status = "rejected"
            prod_data["status"] = "rejected"
            meta.pop("human_approved_at", None)
            if output:
                output.verification_status = "rejected"

        elif payload.action == "undo":
            staging.status = "needs_verification"
            prod_data["status"] = "needs_review"
            meta.pop("human_approved_at", None)
            if output:
                output.verification_status = "needs_review"
                output.applied_to_school = False

        prods[payload.product] = prod_data
        meta["products"] = prods
        staging.metadata_json = meta
        staging.updated_at = now
        updated_ids.append(str(staging.id))

    db.commit()

    action_verbs = {
        "approve": ("Approved", "moved to Approved Schools"),
        "publish": ("Published", "promoted to master production Schools catalog"),
        "reject": ("Rejected", "routed to Re-crawl Queue"),
        "undo": ("Restored", "returned to Verification Queue"),
    }
    verb, dest = action_verbs.get(payload.action, ("Updated", "updated"))
    if payload.action == "publish":
        sandbox_note = ""
        if sandbox_synced_count > 0:
            sandbox_note = f" (Sandbox: {sandbox_synced_count} synced"
            if sandbox_failed_count > 0:
                sandbox_note += f", {sandbox_failed_count} failed)"
            else:
                sandbox_note += ")"
        elif sandbox_failed_count > 0:
            sandbox_note = f" (Sandbox: {sandbox_failed_count} failed — check retry)"
        msg = f"Published {len(updated_ids)} school(s) and {dest}{sandbox_note}."
    else:
        msg = f"{verb} {len(updated_ids)} school(s) and {dest}."

    return BulkReviewActionResponse(
        action=payload.action,
        affected_count=len(updated_ids),
        message=msg,
        updated_school_ids=updated_ids,
    )


@router.post(
    "/schools/{id}/retry-sandbox-sync",
    response_model=SandboxSyncStatusResponse,
    summary="Retry synchronizing a verified/published school to AWS RDS Sandbox",
)
def retry_sandbox_sync(
    id: str,
    db: Session = Depends(get_database_session),
) -> SandboxSyncStatusResponse:
    """Manually retries pushing a school record to AWS RDS Sandbox.

    Extracts active verified fields and executes parameterized upsert into Sandbox.
    Completely ignores specialized curriculum and enrollment fields.
    """
    try:
        s_uuid = UUID(id)
    except (ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid school UUID format: {id}",
        ) from exc

    staging = (
        db.query(StagingSchoolModel)
        .filter(StagingSchoolModel.id == s_uuid, StagingSchoolModel.deleted_at.is_(None))
        .first()
    )
    if not staging:
        # Check if caller passed production_school_id
        staging = (
            db.query(StagingSchoolModel)
            .filter(
                StagingSchoolModel.production_school_id == s_uuid,
                StagingSchoolModel.deleted_at.is_(None),
            )
            .first()
        )

    if not staging:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"School with ID {id} not found in review queue.",
        )

    prod_school = None
    if staging.production_school_id:
        prod_school = db.query(Schools).filter(Schools.id == staging.production_school_id).first()

    output = (
        db.query(MetadataAgentOutputModel)
        .filter(MetadataAgentOutputModel.staging_school_id == staging.id)
        .order_by(MetadataAgentOutputModel.created_at.desc())
        .first()
    )
    extracted = output.extracted_fields if output and output.extracted_fields else {}

    school_data = {
        "name": (prod_school.name if prod_school else None)
        or extracted.get("name")
        or staging.name,
        "website": (prod_school.website if prod_school else None)
        or extracted.get("website")
        or staging.website,
        "address": (prod_school.address if prod_school else None)
        or extracted.get("address")
        or staging.address,
        "phone": (prod_school.phone if prod_school else None)
        or extracted.get("phone")
        or staging.phone,
        "email": extracted.get("email") or staging.email,
        "type": (prod_school.type if prod_school else None)
        or extracted.get("type")
        or staging.type,
        "grades": (prod_school.grades if prod_school else None)
        or extracted.get("grades")
        or staging.grades,
        "description": (prod_school.description if prod_school else None)
        or extracted.get("description"),
    }

    meta = dict(staging.metadata_json or {})
    existing_sandbox_id = (meta.get("sandbox_sync") or {}).get("sandbox_id")

    sync_result = SandboxSyncService.sync_school(
        school_data=school_data,
        match_name=school_data.get("name"),
        existing_sandbox_id=existing_sandbox_id,
    )

    meta["sandbox_sync"] = sync_result.to_dict()
    staging.metadata_json = meta
    staging.updated_at = datetime.now(UTC)
    db.commit()

    return SandboxSyncStatusResponse(
        school_id=str(staging.id),
        status=sync_result.status,
        sandbox_id=sync_result.sandbox_id,
        synced_at=sync_result.synced_at,
        message=sync_result.message,
        error=sync_result.error,
    )

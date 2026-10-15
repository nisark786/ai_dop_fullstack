"""FastAPI router for the Results view (record-by-record crawled output with Batch and Product dropdowns).

Implements multi-format exports (HTML, Excel, CSV) and promotion of staging records to production.
"""

import csv
import io
from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from sqlalchemy.orm import Session

from app.core.database import get_database_session
from app.models.batch import BatchModel
from app.models.metadata_output import MetadataAgentOutputModel
from app.models.pipeline import EvidenceRecordModel
from app.models.schools import Schools
from app.models.staging_school import StagingSchoolModel
from app.schemas.results import (
    PromoteResultResponse,
    ResultSchoolItem,
    ResultsListResponse,
    ResultsSummary,
)
from app.services.promotion.school_promotion_service import SchoolPromotionService

router = APIRouter(prefix="/results", tags=["Results"])

# Product column definitions
PRODUCT_SPECS = {
    "info": {
        "name": "School Profile & Metadata",
        "value1_label": "Grade band",
        "value2_label": "Contact / Phone",
        "value3_label": "Learning Model",
    },
}


def _format_timestamp(dt: datetime | None) -> str:
    if not dt:
        return "Unrecorded"
    return dt.strftime("%b %d, %Y %H:%M CT")


def _resolve_values_for_product(
    product_key: str,
    school_name: str,
    staging: StagingSchoolModel | None,
    output: MetadataAgentOutputModel | None,
    prod_school: Schools | None,
) -> tuple[str, str, str]:
    """Resolves Grade band, Phone/Contact, Learning Model for the Metadata Agent."""
    extracted = output.extracted_fields if output and output.extracted_fields else {}

    # Grades normalization
    raw_grades = (
        extracted.get("grades")
        or (staging.grades if staging else None)
        or (prod_school.grades if prod_school else None)
    )
    if isinstance(raw_grades, list) and raw_grades:
        grade_str = (
            f"{raw_grades[0]}–{raw_grades[-1]}" if len(raw_grades) > 1 else str(raw_grades[0])
        )
    elif isinstance(raw_grades, str) and raw_grades:
        grade_str = raw_grades
    else:
        grade_str = "Unspecified"

    phone_val = (
        extracted.get("phone")
        or (staging.phone if staging else None)
        or (prod_school.phone if prod_school else None)
        or "Not listed"
    )
    learning_model = extracted.get("learning_models")
    if isinstance(learning_model, list) and learning_model:
        model_val = ", ".join(learning_model[:2]).title()
    elif isinstance(learning_model, str) and learning_model:
        model_val = learning_model.title()
    else:
        model_val = "Not listed"

    return grade_str, phone_val, model_val


def _build_results_data(
    db: Session,
    batch_id: str | None,
    product: str,
    search: str | None,
    status_filter: str | None,
) -> tuple[list[ResultSchoolItem], ResultsSummary]:
    """Internal helper to aggregate result rows from staging schools and legacy runs."""
    prod_spec = PRODUCT_SPECS.get(product, PRODUCT_SPECS["info"])
    records: list[ResultSchoolItem] = []

    # 1. Query batches lookup map
    all_batches = {b.id: b.name for b in db.query(BatchModel).all()}

    # 2. Query staging schools
    staging_query = db.query(StagingSchoolModel).filter(StagingSchoolModel.deleted_at.is_(None))
    if batch_id and batch_id.lower() not in {"all", ""}:
        try:
            b_uuid = UUID(batch_id)
            staging_query = staging_query.filter(StagingSchoolModel.batch_id == b_uuid)
        except ValueError:
            pass

    if search and search.strip():
        term = f"%{search.strip()}%"
        staging_query = staging_query.filter(
            (StagingSchoolModel.name.ilike(term)) | (StagingSchoolModel.district.ilike(term))
        )

    staging_list = staging_query.order_by(StagingSchoolModel.created_at.desc()).all()

    for st in staging_list:
        # Latest output
        output = (
            db.query(MetadataAgentOutputModel)
            .filter(MetadataAgentOutputModel.staging_school_id == st.id)
            .order_by(MetadataAgentOutputModel.created_at.desc())
            .first()
        )
        evidence_count = (
            db.query(EvidenceRecordModel)
            .filter(EvidenceRecordModel.staging_school_id == st.id)
            .count()
        )

        v1, v2, v3 = _resolve_values_for_product(product, st.name, st, output, None)

        # Normalize status into 4 primary badge categories
        raw_status = (st.status or "pending").lower()
        if raw_status == "published":
            item_status = "Published"
        elif raw_status == "verified":
            item_status = "Verified"
        elif raw_status in {"needs_verification", "needs_review", "pending", "crawling"}:
            item_status = "Needs Verification" if raw_status != "pending" else "Completed"
        else:
            item_status = "Completed"

        # Apply status filter if provided
        if (
            status_filter
            and status_filter.lower() not in {"all", ""}
            and item_status.lower().replace(" ", "_") != status_filter.lower().replace(" ", "_")
        ):
            continue

        batch_name = all_batches.get(st.batch_id, "Standard Batch")

        ext = output.extracted_fields if output and output.extracted_fields else {}
        website_val = ext.get("website") or st.website
        address_val = ext.get("address") or st.address
        phone_val = ext.get("phone") or st.phone
        email_val = ext.get("email") or st.email
        grades_val = ext.get("grades") or st.grades or []
        if isinstance(grades_val, str):
            grades_val = [grades_val]
        type_val = ext.get("type") or st.type or ["private"]
        if isinstance(type_val, str):
            type_val = [type_val]
        desc_val = ext.get("description")
        open_enr_val = ext.get("open_enrollment")
        open_enr_grades_val = ext.get("open_enrollment_grades") or []
        base_tuition_val = ext.get("base_tuition")
        teaching_style_val = ext.get("teaching_style")
        learning_models_val = ext.get("learning_models") or []
        if isinstance(learning_models_val, str):
            learning_models_val = [learning_models_val]
        extracurriculars_val = ext.get("extracurricular_programs") or []
        if isinstance(extracurriculars_val, str):
            extracurriculars_val = [extracurriculars_val]

        post_rec = (
            ext
            if ext
            else {
                "id": str(st.id),
                "name": st.name,
                "address": address_val,
                "phone": phone_val,
                "email": email_val,
                "website": website_val,
                "type": type_val,
                "grades": grades_val,
                "description": desc_val,
                "extracurricular_programs": extracurriculars_val,
                "learning_models": learning_models_val,
                "teaching_style": teaching_style_val,
                "open_enrollment": open_enr_val,
                "open_enrollment_grades": open_enr_grades_val,
                "base_tuition": base_tuition_val,
                "is_active": (output.overall_score > 0) if output else True,
            }
        )

        records.append(
            ResultSchoolItem(
                id=str(st.id),
                school_id=str(st.id),
                school_name=st.name,
                district=st.district or "Independent District",
                batch_id=str(st.batch_id),
                batch_name=batch_name,
                product_key=product,
                product_name=prod_spec["name"],
                value1_label=prod_spec["value1_label"],
                value1_value=v1,
                value2_label=prod_spec["value2_label"],
                value2_value=v2,
                value3_label=prod_spec["value3_label"],
                value3_value=v3,
                website=website_val,
                address=address_val,
                phone=phone_val,
                email=email_val,
                grades=grades_val,
                school_type=type_val,
                description=desc_val,
                open_enrollment=open_enr_val,
                open_enrollment_grades=open_enr_grades_val,
                base_tuition=base_tuition_val,
                teaching_style=teaching_style_val,
                learning_models=learning_models_val,
                extracurricular_programs=extracurriculars_val,
                post_ingestion_record=post_rec,
                status=item_status,
                crawled_at=_format_timestamp(st.updated_at or st.created_at),
                overall_score=output.overall_score if output else None,
                evidence_count=evidence_count,
                extracted_fields=output.extracted_fields if output else (st.source_data or {}),
                recommendations=output.recommendations if output else [],
                is_promoted=bool(st.production_school_id),
            )
        )

    # 3. If staging schools are empty (or searching across all), check legacy metadata outputs
    if not records and (not batch_id or batch_id.lower() == "all"):
        outputs = (
            db.query(MetadataAgentOutputModel)
            .order_by(MetadataAgentOutputModel.created_at.desc())
            .limit(50)
            .all()
        )
        for out in outputs:
            school = (
                db.query(Schools).filter(Schools.id == out.school_id).first()
                if out.school_id
                else None
            )
            school_name = school.name if school else "Unknown School"
            district = getattr(school, "district_name", None) or "Independent School District"

            if (
                search
                and search.strip()
                and search.lower() not in school_name.lower()
                and search.lower() not in district.lower()
            ):
                continue

            v1, v2, v3 = _resolve_values_for_product(product, school_name, None, out, school)
            item_status = (
                "Verified" if out.verification_status == "verified" else "Needs Verification"
            )

            ext = out.extracted_fields or {}
            website_val = (
                ext.get("website")
                or (school.website if school else None)
                or getattr(school, "url", None)
            )
            address_val = (
                ext.get("address")
                or (school.address if school else None)
                or getattr(school, "full_address", None)
            )
            phone_val = ext.get("phone") or (school.phone if school else None)
            email_val = ext.get("email") or (school.email if school else None)
            grades_val = ext.get("grades") or (school.grades if school else None) or []
            if isinstance(grades_val, str):
                grades_val = [grades_val]
            type_val = ext.get("type") or (school.type if school else None) or ["private"]
            if isinstance(type_val, str):
                type_val = [type_val]
            desc_val = ext.get("description") or (school.description if school else None)
            open_enr_val = ext.get("open_enrollment")
            open_enr_grades_val = ext.get("open_enrollment_grades") or []
            base_tuition_val = ext.get("base_tuition")
            teaching_style_val = ext.get("teaching_style")
            learning_models_val = ext.get("learning_models") or []
            if isinstance(learning_models_val, str):
                learning_models_val = [learning_models_val]
            extracurriculars_val = ext.get("extracurricular_programs") or []
            if isinstance(extracurriculars_val, str):
                extracurriculars_val = [extracurriculars_val]

            post_rec = (
                ext
                if ext
                else {
                    "id": str(out.school_id or out.id),
                    "name": school_name,
                    "address": address_val,
                    "phone": phone_val,
                    "email": email_val,
                    "website": website_val,
                    "type": type_val,
                    "grades": grades_val,
                    "description": desc_val,
                    "extracurricular_programs": extracurriculars_val,
                    "learning_models": learning_models_val,
                    "teaching_style": teaching_style_val,
                    "open_enrollment": open_enr_val,
                    "open_enrollment_grades": open_enr_grades_val,
                    "base_tuition": base_tuition_val,
                    "is_active": out.overall_score > 0,
                }
            )

            records.append(
                ResultSchoolItem(
                    id=str(out.id),
                    school_id=str(out.school_id or out.id),
                    school_name=school_name,
                    district=district,
                    batch_id=str(out.batch_id) if out.batch_id else None,
                    batch_name=all_batches.get(out.batch_id, "Sample Intake Batch"),
                    product_key=product,
                    product_name=prod_spec["name"],
                    value1_label=prod_spec["value1_label"],
                    value1_value=v1,
                    value2_label=prod_spec["value2_label"],
                    value2_value=v2,
                    value3_label=prod_spec["value3_label"],
                    value3_value=v3,
                    website=website_val,
                    address=address_val,
                    phone=phone_val,
                    email=email_val,
                    grades=grades_val,
                    school_type=type_val,
                    description=desc_val,
                    open_enrollment=open_enr_val,
                    open_enrollment_grades=open_enr_grades_val,
                    base_tuition=base_tuition_val,
                    teaching_style=teaching_style_val,
                    learning_models=learning_models_val,
                    extracurricular_programs=extracurriculars_val,
                    post_ingestion_record=post_rec,
                    status=item_status,
                    crawled_at=_format_timestamp(out.created_at),
                    overall_score=out.overall_score,
                    evidence_count=1,
                    extracted_fields=out.extracted_fields or {},
                    recommendations=out.recommendations or [],
                    is_promoted=True,
                )
            )

    # Summary metrics
    summary = ResultsSummary(
        total_records=len(records),
        published_count=sum(1 for r in records if r.status == "Published"),
        verified_count=sum(1 for r in records if r.status == "Verified"),
        needs_verification_count=sum(1 for r in records if r.status == "Needs Verification"),
        completed_count=sum(1 for r in records if r.status == "Completed"),
    )

    return records, summary


@router.get(
    "",
    response_model=ResultsListResponse,
    summary="List crawled results with batch & product filtering",
)
def list_results(
    batch_id: str | None = Query(None, description="Filter by batch UUID or 'all'"),
    product: str = Query("info", description="Target product key (info)"),
    search: str | None = Query(None, description="Search filter by school name or district"),
    status_filter: str | None = Query(None, alias="status", description="Filter by status badge"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_database_session),
) -> ResultsListResponse:
    """Returns record-by-record crawled outputs configured for the Results view."""
    records, summary = _build_results_data(db, batch_id, product, search, status_filter)
    paginated = records[offset : offset + limit]

    return ResultsListResponse(
        records=paginated,
        summary=summary,
        selected_batch_id=batch_id,
        selected_product_key=product,
    )


@router.post(
    "/{staging_id}/promote",
    response_model=PromoteResultResponse,
    summary="Promote verified staging school to production",
)
def promote_school_to_production(
    staging_id: str,
    db: Session = Depends(get_database_session),
) -> PromoteResultResponse:
    """Promotes a verified staging school into the golden production `schools` table."""
    try:
        uuid_obj = UUID(staging_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid staging ID format.") from e

    try:
        prod_school = SchoolPromotionService.promote_staging_school(db, uuid_obj)
        return PromoteResultResponse(
            staging_id=uuid_obj,
            production_school_id=prod_school.id,
            school_name=prod_school.name,
            status="published",
            message=f"School '{prod_school.name}' successfully promoted to production database.",
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Promotion failed: {e}") from e


@router.get("/export/csv", summary="Export Results to CSV")
def export_results_csv(
    batch_id: str | None = Query(None),
    product: str = Query("info"),
    search: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    db: Session = Depends(get_database_session),
):
    """Exports filtered results as a standard CSV download."""
    records, _ = _build_results_data(db, batch_id, product, search, status_filter)
    prod_spec = PRODUCT_SPECS.get(product, PRODUCT_SPECS["info"])

    output = io.StringIO()
    writer = csv.writer(output)

    if product == "info":
        writer.writerow(
            [
                "School Name",
                "District",
                "Address",
                "Website",
                "Phone",
                "Email",
                "Type",
                "Grades",
                "Description",
                "Learning Models",
                "Teaching Style",
                "Extracurriculars",
                "Open Enrollment",
                "Base Tuition",
                "DQA Score",
                "Status",
                "Batch",
            ]
        )
        for r in records:
            writer.writerow(
                [
                    r.school_name,
                    r.district or "",
                    r.address or "",
                    r.website or "",
                    r.phone or "",
                    r.email or "",
                    ", ".join(r.school_type) if r.school_type else "",
                    ", ".join(r.grades) if r.grades else "",
                    r.description or "",
                    ", ".join(r.learning_models) if r.learning_models else "",
                    r.teaching_style or "",
                    ", ".join(r.extracurricular_programs) if r.extracurricular_programs else "",
                    (
                        "Yes"
                        if r.open_enrollment is True
                        else ("No" if r.open_enrollment is False else "")
                    ),
                    r.base_tuition or "",
                    f"{r.overall_score}/100" if r.overall_score is not None else "",
                    r.status,
                    r.batch_name or "",
                ]
            )
    else:
        writer.writerow(
            [
                "School",
                "District",
                "Batch",
                "Product",
                prod_spec["value1_label"],
                prod_spec["value2_label"],
                prod_spec["value3_label"],
                "Status",
                "Crawled",
            ]
        )
        for r in records:
            writer.writerow(
                [
                    r.school_name,
                    r.district,
                    r.batch_name,
                    r.product_name,
                    r.value1_value,
                    r.value2_value,
                    r.value3_value,
                    r.status,
                    r.crawled_at,
                ]
            )

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=results_{product}.csv"},
    )


@router.get("/export/excel", summary="Export Results to Excel")
def export_results_excel(
    batch_id: str | None = Query(None),
    product: str = Query("info"),
    search: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    db: Session = Depends(get_database_session),
):
    """Exports filtered results as a styled XLSX workbook."""
    records, _ = _build_results_data(db, batch_id, product, search, status_filter)
    prod_spec = PRODUCT_SPECS.get(product, PRODUCT_SPECS["info"])

    wb = Workbook()
    ws = wb.active
    ws.title = "Results"

    if product == "info":
        headers = [
            "School Name",
            "District",
            "Address",
            "Website",
            "Phone",
            "Email",
            "Type",
            "Grades",
            "Description",
            "Learning Models",
            "Teaching Style",
            "Extracurriculars",
            "Open Enrollment",
            "Base Tuition",
            "DQA Score",
            "Status",
            "Batch",
        ]
    else:
        headers = [
            "School",
            "District",
            "Batch",
            "Product",
            prod_spec["value1_label"],
            prod_spec["value2_label"],
            prod_spec["value3_label"],
            "Status",
            "Crawled",
        ]

    ws.append(headers)

    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")

    for col_num in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_num)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center", vertical="center")

    for r in records:
        if product == "info":
            ws.append(
                [
                    r.school_name,
                    r.district or "",
                    r.address or "",
                    r.website or "",
                    r.phone or "",
                    r.email or "",
                    ", ".join(r.school_type) if r.school_type else "",
                    ", ".join(r.grades) if r.grades else "",
                    r.description or "",
                    ", ".join(r.learning_models) if r.learning_models else "",
                    r.teaching_style or "",
                    ", ".join(r.extracurricular_programs) if r.extracurricular_programs else "",
                    (
                        "Yes"
                        if r.open_enrollment is True
                        else ("No" if r.open_enrollment is False else "")
                    ),
                    r.base_tuition or "",
                    f"{r.overall_score}/100" if r.overall_score is not None else "",
                    r.status,
                    r.batch_name or "",
                ]
            )
        else:
            ws.append(
                [
                    r.school_name,
                    r.district,
                    r.batch_name,
                    r.product_name,
                    r.value1_value,
                    r.value2_value,
                    r.value3_value,
                    r.status,
                    r.crawled_at,
                ]
            )

    # Auto-adjust column widths
    for col in ws.columns:
        max_len = max(len(str(cell.value or "")) for cell in col)
        col_letter = col[0].column_letter
        ws.column_dimensions[col_letter].width = max(max_len + 3, 14)

    stream = io.BytesIO()
    wb.save(stream)
    stream.seek(0)

    return Response(
        content=stream.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=results_{product}.xlsx"},
    )


@router.get("/export/html", summary="View or Download Results as HTML report")
def export_results_html(
    batch_id: str | None = Query(None),
    product: str = Query("info"),
    search: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    db: Session = Depends(get_database_session),
):
    """Exports or previews filtered results as a responsive standalone HTML report."""
    records, summary = _build_results_data(db, batch_id, product, search, status_filter)
    prod_spec = PRODUCT_SPECS.get(product, PRODUCT_SPECS["info"])

    rows_html = ""
    for r in records:
        status_color = "#2563EB"
        if r.status == "Published":
            status_color = "#0F172A"
        elif r.status == "Verified":
            status_color = "#059669"
        elif r.status == "Needs Verification":
            status_color = "#D97706"

        if product == "info":
            contact_str = " • ".join(filter(None, [r.phone, r.email])) or "Not listed"
            grades_str = (
                ", ".join(r.grades[:4]) + ("..." if len(r.grades) > 4 else "")
                if r.grades
                else "Not listed"
            )
            score_badge = f"{r.overall_score}/100" if r.overall_score is not None else "N/A"
            rows_html += f"""
            <tr style="border-bottom: 1px solid #E2E8F0;">
                <td style="padding: 12px 16px;">
                    <div style="font-weight: 600; color: #0F172A;">{r.school_name}</div>
                    <div style="font-size: 12px; color: #64748B;">{r.district or ""}</div>
                </td>
                <td style="padding: 12px 16px; font-size: 13px;">
                    {f'<a href="{r.website}" target="_blank" style="color: #2563EB; text-decoration: none;">{r.website}</a>' if r.website else '<span style="color: #94A3B8;">No website</span>'}
                </td>
                <td style="padding: 12px 16px; font-size: 12px; color: #334155;">{contact_str}</td>
                <td style="padding: 12px 16px; font-size: 12px; color: #334155;">{grades_str}</td>
                <td style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: #0F172A;">{score_badge}</td>
                <td style="padding: 12px 16px;">
                    <span style="display: inline-block; padding: 3px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; color: #FFF; background: {status_color};">
                        {r.status}
                    </span>
                </td>
                <td style="padding: 12px 16px; font-size: 12px; color: #64748B;">{r.crawled_at}</td>
            </tr>
            """
        else:
            rows_html += f"""
            <tr style="border-bottom: 1px solid #E2E8F0;">
                <td style="padding: 12px 16px;">
                    <div style="font-weight: 600; color: #0F172A;">{r.school_name}</div>
                    <div style="font-size: 12px; color: #64748B;">{r.district or ""}</div>
                </td>
                <td style="padding: 12px 16px; font-size: 13px; color: #334155;">{r.value1_value}</td>
                <td style="padding: 12px 16px; font-size: 13px; color: #334155;">{r.value2_value}</td>
                <td style="padding: 12px 16px; font-size: 13px; color: #334155;">{r.value3_value}</td>
                <td style="padding: 12px 16px;">
                    <span style="display: inline-block; padding: 3px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; color: #FFF; background: {status_color};">
                        {r.status}
                    </span>
                </td>
                <td style="padding: 12px 16px; font-size: 12px; color: #64748B;">{r.crawled_at}</td>
            </tr>
            """

    if product == "info":
        table_headers = """
            <th>SCHOOL</th>
            <th>WEBSITE</th>
            <th>CONTACT</th>
            <th>GRADES</th>
            <th>DQA SCORE</th>
            <th>STATUS</th>
            <th>CRAWLED</th>
        """
    else:
        table_headers = f"""
            <th>SCHOOL</th>
            <th>{prod_spec["value1_label"].upper()}</th>
            <th>{prod_spec["value2_label"].upper()}</th>
            <th>{prod_spec["value3_label"].upper()}</th>
            <th>STATUS</th>
            <th>CRAWLED</th>
        """

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>SchoolPath - Crawled Results Report</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #F8FAFC; margin: 0; padding: 32px; color: #0F172A; }}
        .container {{ max-width: 1200px; margin: 0 auto; background: #FFF; border: 1px solid #E2E8F0; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); overflow: hidden; }}
        .header {{ padding: 24px; border-bottom: 1px solid #E2E8F0; background: #F8FAFC; display: flex; justify-content: space-between; align-items: center; }}
        table {{ width: 100%; border-collapse: collapse; text-align: left; }}
        th {{ padding: 12px 16px; background: #F1F5F9; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; border-bottom: 1px solid #CBD5E1; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div>
                <h1 style="margin: 0; font-size: 20px; font-weight: bold;">Results: {prod_spec["name"]}</h1>
                <p style="margin: 4px 0 0; font-size: 13px; color: #64748B;">Latest crawled output, record by record • {summary.total_records} Records</p>
            </div>
            <div style="font-size: 12px; color: #64748B;">Generated: {datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC")}</div>
        </div>
        <table>
            <thead>
                <tr>
                    {table_headers}
                </tr>
            </thead>
            <tbody>
                {rows_html}
            </tbody>
        </table>
    </div>
</body>
</html>"""

    return Response(content=html_content, media_type="text/html")

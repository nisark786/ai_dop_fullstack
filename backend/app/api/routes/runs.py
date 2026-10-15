"""
FastAPI router for Batch Pipeline Runs History and Multi-Format Exports (HTML, Excel, CSV).
"""

import re

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_database_session
from app.models.batch import BatchModel
from app.models.metadata_output import MetadataAgentOutputModel
from app.models.schools import Schools
from app.models.staging_school import StagingSchoolModel
from app.schemas.runs import BatchRunDetailResponse, BatchRunSummary, SchoolRunOutputItem
from app.services.reporting.html_report_service import HtmlReportService
from app.services.reporting.spreadsheet_service import SpreadsheetReportService

router = APIRouter(prefix="/runs", tags=["Pipeline Runs"])


def _slugify(text: str) -> str:
    s = re.sub(r"[^\w\s-]", "", text).strip().lower()
    return re.sub(r"[-\s]+", "-", s) or "batch"


def _build_run_data(job_id: str, db: Session):
    """Internal helper to aggregate run summary and per-school outputs."""
    outputs = (
        db.query(MetadataAgentOutputModel)
        .filter(MetadataAgentOutputModel.job_id == job_id)
        .order_by(MetadataAgentOutputModel.created_at.asc())
        .all()
    )
    if not outputs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Run '{job_id}' not found.",
        )

    first = outputs[0]
    target_batch_id = next((o.batch_id for o in outputs if o.batch_id is not None), None)
    batch_name = "Unknown Batch"
    if target_batch_id:
        batch = db.query(BatchModel).filter(BatchModel.id == target_batch_id).first()
        if batch:
            batch_name = batch.name

    total_schools = len(outputs)
    verified_count = sum(1 for o in outputs if o.verification_status == "verified")
    needs_review_count = total_schools - verified_count
    total_score = sum(o.overall_score for o in outputs)
    avg_score = round(total_score / max(total_schools, 1))
    cache_hits_total = sum(o.cache_hits_count for o in outputs)

    summary_dict = {
        "job_id": job_id,
        "batch_id": first.batch_id,
        "batch_name": batch_name,
        "agent_name": "School Profile & Metadata Agent",
        "agent_version": first.agent_version or "1.2.0",
        "total_schools": total_schools,
        "verified_count": verified_count,
        "needs_review_count": needs_review_count,
        "avg_score": avg_score,
        "cache_hits_total": cache_hits_total,
        "status": "completed",
        "created_at": first.created_at.strftime("%Y-%m-%d %H:%M:%S") if first.created_at else "",
    }

    schools_list = []
    for o in outputs:
        school = None
        if o.school_id:
            school = db.query(Schools).filter(Schools.id == o.school_id).first()
        if not school and o.staging_school_id:
            school = (
                db.query(StagingSchoolModel)
                .filter(StagingSchoolModel.id == o.staging_school_id)
                .first()
            )

        s_name = school.name if school else "Unknown School"
        s_website = school.website if school else (o.extracted_fields or {}).get("website")
        s_address = (
            school.address
            if school and school.address
            else (o.extracted_fields or {}).get("address")
        )

        schools_list.append(
            {
                "school_id": str(o.school_id),
                "school_name": s_name,
                "website": s_website,
                "address": s_address,
                "overall_score": o.overall_score,
                "verification_status": o.verification_status,
                "extracted_fields": o.extracted_fields or {},
                "recommendations": o.recommendations or [],
                "pages_crawled_count": o.pages_crawled_count,
                "cache_hits_count": o.cache_hits_count,
                "applied_to_school": o.applied_to_school,
                "crawled_at": o.created_at.strftime("%Y-%m-%d %H:%M:%S") if o.created_at else "",
            }
        )

    return summary_dict, schools_list


@router.get("", response_model=list[BatchRunSummary], summary="List all batch pipeline runs")
def list_batch_runs(db: Session = Depends(get_database_session)) -> list[BatchRunSummary]:
    """Retrieves all aggregated batch execution runs ordered by most recent."""
    outputs = (
        db.query(MetadataAgentOutputModel)
        .order_by(MetadataAgentOutputModel.created_at.desc())
        .all()
    )

    runs_map: dict[str, list[MetadataAgentOutputModel]] = {}
    for o in outputs:
        if o.job_id not in runs_map:
            runs_map[o.job_id] = []
        runs_map[o.job_id].append(o)

    results: list[BatchRunSummary] = []
    for job_id, job_outputs in runs_map.items():
        first = job_outputs[0]
        target_batch_id = next((x.batch_id for x in job_outputs if x.batch_id is not None), None)
        batch_name = "Unknown Batch"
        if target_batch_id:
            batch = db.query(BatchModel).filter(BatchModel.id == target_batch_id).first()
            if batch:
                batch_name = batch.name

        total = len(job_outputs)
        verified = sum(1 for x in job_outputs if x.verification_status == "verified")
        needs_review = total - verified
        avg_score = round(sum(x.overall_score for x in job_outputs) / max(total, 1))
        cache_hits = sum(x.cache_hits_count for x in job_outputs)

        results.append(
            BatchRunSummary(
                job_id=job_id,
                batch_id=first.batch_id,
                batch_name=batch_name,
                agent_name="School Profile & Metadata Agent",
                agent_version=first.agent_version or "1.2.0",
                total_schools=total,
                verified_count=verified,
                needs_review_count=needs_review,
                avg_score=avg_score,
                cache_hits_total=cache_hits,
                status="completed",
                created_at=first.created_at.strftime("%Y-%m-%d %H:%M:%S")
                if first.created_at
                else "",
            )
        )

    return results


@router.get(
    "/{job_id}", response_model=BatchRunDetailResponse, summary="Get details of a batch run"
)
def get_batch_run_detail(
    job_id: str, db: Session = Depends(get_database_session)
) -> BatchRunDetailResponse:
    """Retrieves full details and school-by-school output of a specific batch run."""
    summary_dict, schools_list = _build_run_data(job_id, db)

    return BatchRunDetailResponse(
        summary=BatchRunSummary(**summary_dict),
        schools=[SchoolRunOutputItem(**s) for s in schools_list],
    )


@router.get("/{job_id}/export/html", summary="Download standalone HTML report for a batch run")
def export_batch_run_html(job_id: str, db: Session = Depends(get_database_session)) -> Response:
    """Generates and downloads a self-contained responsive HTML report."""
    summary_dict, schools_list = _build_run_data(job_id, db)
    html_content = HtmlReportService.generate_batch_run_report(summary_dict, schools_list)

    batch_slug = _slugify(summary_dict.get("batch_name", "batch"))
    filename = f"report-{batch_slug}-{job_id}.html"

    return Response(
        content=html_content,
        media_type="text/html; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{job_id}/export/excel", summary="Download Excel workbook for a batch run")
def export_batch_run_excel(job_id: str, db: Session = Depends(get_database_session)) -> Response:
    """Generates and downloads a styled Excel (.xlsx) spreadsheet."""
    summary_dict, schools_list = _build_run_data(job_id, db)
    excel_stream = SpreadsheetReportService.generate_excel_workbook(summary_dict, schools_list)

    batch_slug = _slugify(summary_dict.get("batch_name", "batch"))
    filename = f"run-{batch_slug}-{job_id}.xlsx"

    return Response(
        content=excel_stream.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{job_id}/export/csv", summary="Download CSV data for a batch run")
def export_batch_run_csv(job_id: str, db: Session = Depends(get_database_session)) -> Response:
    """Generates and downloads a standard CSV data file."""
    summary_dict, schools_list = _build_run_data(job_id, db)
    csv_stream = SpreadsheetReportService.generate_csv_stream(schools_list)

    batch_slug = _slugify(summary_dict.get("batch_name", "batch"))
    filename = f"run-{batch_slug}-{job_id}.csv"

    return Response(
        content=csv_stream.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

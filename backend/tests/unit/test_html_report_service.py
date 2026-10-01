"""Unit tests for the HtmlReportService.

Covers:
- Value formatting (_format_val): booleans, empty strings, lists, HTML escaping
- Full report generation (generate_batch_run_report)
- KPI metric calculation and formatting
- School cards and recommendations rendering
- XSS escaping and safety
"""

from app.services.reporting.html_report_service import HtmlReportService


class TestHtmlReportServiceFormatVal:
    """Tests for HtmlReportService._format_val helper."""

    def test_format_val_none_returns_empty_span(self):
        assert HtmlReportService._format_val(None) == '<span class="empty">—</span>'

    def test_format_val_empty_string_returns_empty_span(self):
        assert HtmlReportService._format_val("") == '<span class="empty">—</span>'
        assert HtmlReportService._format_val("   ") == '<span class="empty">—</span>'

    def test_format_val_booleans(self):
        assert HtmlReportService._format_val(True) == "Yes"
        assert HtmlReportService._format_val(False) == "No"

    def test_format_val_empty_list_returns_empty_span(self):
        assert HtmlReportService._format_val([]) == '<span class="empty">—</span>'

    def test_format_val_list_of_items(self):
        result = HtmlReportService._format_val(["K", "1", "2"])
        assert result == "K, 1, 2"

    def test_format_val_escapes_html(self):
        unsafe = "<script>alert('xss')</script>"
        result = HtmlReportService._format_val(unsafe)
        assert "<script>" not in result
        assert "&lt;script&gt;" in result


class TestHtmlReportServiceGenerateReport:
    """Tests for HtmlReportService.generate_batch_run_report."""

    def test_generate_report_structure(self):
        summary = {
            "job_id": "JOB-12345",
            "batch_name": "Autumn 2026 Intake",
            "created_at": "2026-09-30T10:00:00Z",
            "total_schools": 2,
            "verified_count": 1,
            "needs_review_count": 1,
            "avg_score": 88,
            "cache_hits_total": 4,
        }
        schools = [
            {
                "school_name": "Horizon Academy",
                "overall_score": 95,
                "verification_status": "verified",
                "extracted_fields": {
                    "phone": "512-555-0100",
                    "email": "info@horizon.edu",
                    "website": "https://horizon.edu",
                    "address": "123 Horizon Way",
                    "grades": ["9", "10", "11", "12"],
                    "open_enrollment": True,
                    "extracurricular_programs": ["Robotics", "Debate"],
                    "description": "Excellence in STEM education.",
                },
                "recommendations": [],
            },
            {
                "school_name": "Pinnacle Prep",
                "overall_score": 75,
                "verification_status": "needs_review",
                "extracted_fields": {
                    "phone": None,
                    "website": "https://pinnacle.edu",
                },
                "recommendations": [
                    {
                        "field": "phone",
                        "recommended": "512-555-0200",
                        "confidence": 0.85,
                    }
                ],
            },
        ]

        html = HtmlReportService.generate_batch_run_report(summary, schools)

        assert html.startswith("<!DOCTYPE html>")
        assert "Autumn 2026 Intake" in html
        assert "JOB-12345" in html
        assert "Horizon Academy" in html
        assert "Pinnacle Prep" in html
        assert "badge-verified" in html
        assert "badge-review" in html
        assert "95% Score" in html
        assert "75% Score" in html
        assert "85% confidence" in html
        assert "512-555-0100" in html
        assert "Robotics, Debate" in html

    def test_generate_report_empty_schools_list(self):
        summary = {
            "job_id": "JOB-EMPTY",
            "batch_name": "Empty Batch",
            "total_schools": 0,
            "verified_count": 0,
            "needs_review_count": 0,
            "avg_score": 0,
        }
        html = HtmlReportService.generate_batch_run_report(summary, [])

        assert "<!DOCTYPE html>" in html
        assert "Empty Batch" in html
        assert "JOB-EMPTY" in html
        assert "0% Score" not in html  # No school cards rendered

    def test_generate_report_xss_safety(self):
        summary = {
            "job_id": "<script>alert('job')</script>",
            "batch_name": "<img src=x onerror=alert('batch')>",
            "total_schools": 1,
            "verified_count": 1,
        }
        schools = [
            {
                "school_name": "<b>Bold School</b>",
                "overall_score": 90,
                "verification_status": "verified",
                "extracted_fields": {
                    "description": "<script>evil()</script>",
                },
                "recommendations": [
                    {
                        "field": "<svg onload=alert(1)>",
                        "recommended": "<iframe src='evil.com'></iframe>",
                        "confidence": 0.9,
                    }
                ],
            }
        ]

        html = HtmlReportService.generate_batch_run_report(summary, schools)

        assert "<script>" not in html
        assert "<img src=x onerror" not in html
        assert "<b>Bold School</b>" not in html
        assert "&lt;b&gt;Bold School&lt;/b&gt;" in html
        assert "&lt;script&gt;evil()&lt;/script&gt;" in html
        assert "<iframe" not in html

    def test_generate_report_handles_defaults_when_keys_missing(self):
        # Pass minimal dictionaries with missing keys
        html = HtmlReportService.generate_batch_run_report({}, [{}])
        assert "<!DOCTYPE html>" in html
        assert "Unknown School" in html
        assert "needs_review" in html or "Needs Review" in html

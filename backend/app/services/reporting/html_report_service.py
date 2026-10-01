"""
HTML Report Generation Service for Batch Pipeline Runs.
Generates a standalone, beautiful, self-contained HTML document with embedded CSS
that can be opened in any browser or emailed to external stakeholders without authentication.
"""

from datetime import datetime
from html import escape
from typing import Any


class HtmlReportService:
    """Generates self-contained, responsive HTML reports for pipeline runs."""

    @staticmethod
    def _format_val(val: Any) -> str:
        if val is None:
            return '<span class="empty">—</span>'
        if isinstance(val, bool):
            return "Yes" if val else "No"
        if isinstance(val, list):
            if not val:
                return '<span class="empty">—</span>'
            return escape(", ".join(str(x) for x in val))
        s = str(val).strip()
        return escape(s) if s else '<span class="empty">—</span>'

    @classmethod
    def generate_batch_run_report(
        cls,
        summary: dict[str, Any],
        schools: list[dict[str, Any]],
    ) -> str:
        """
        Builds a self-contained HTML string showcasing the batch run summary and per-school outputs.
        """
        job_id = escape(str(summary.get("job_id", "N/A")))
        batch_name = escape(str(summary.get("batch_name", "Batch Run")))
        created_at = escape(str(summary.get("created_at", datetime.now().isoformat())))
        total_schools = summary.get("total_schools", len(schools))
        verified_count = summary.get("verified_count", 0)
        needs_review_count = summary.get("needs_review_count", 0)
        avg_score = summary.get("avg_score", 0)
        cache_hits_total = summary.get("cache_hits_total", 0)

        verified_rate = (
            round((verified_count / max(total_schools, 1)) * 100, 1) if total_schools else 0
        )

        # Build school cards HTML
        school_cards_html = []
        for idx, s in enumerate(schools, start=1):
            s_name = escape(str(s.get("school_name", "Unknown School")))
            s_score = s.get("overall_score", 0)
            status = s.get("verification_status", "needs_review")
            is_verified = status == "verified"
            status_badge_class = "badge-verified" if is_verified else "badge-review"
            status_label = "Verified" if is_verified else "Needs Review"

            ext = s.get("extracted_fields", {}) or {}
            recs = s.get("recommendations", []) or []

            # Format field values
            phone_val = cls._format_val(ext.get("phone"))
            email_val = cls._format_val(ext.get("email"))
            website_val = ext.get("website") or s.get("website")
            website_html = (
                f'<a href="{escape(str(website_val))}" target="_blank" rel="noreferrer">{escape(str(website_val))}</a>'
                if website_val
                else '<span class="empty">—</span>'
            )
            address_val = cls._format_val(ext.get("address") or s.get("address"))
            grades_val = cls._format_val(ext.get("grades"))
            desc_val = cls._format_val(ext.get("description"))
            open_enr_val = cls._format_val(ext.get("open_enrollment"))
            prog_val = cls._format_val(ext.get("extracurricular_programs"))

            # Build recommendations list HTML
            recs_html = ""
            if recs:
                rec_items = []
                for r in recs:
                    f_name = escape(str(r.get("field", "")).replace("_", " ").title())
                    rec_val = cls._format_val(r.get("recommended"))
                    conf = r.get("confidence", 0)
                    conf_pct = (
                        round(conf * 100)
                        if isinstance(conf, (int, float)) and conf <= 1
                        else round(conf)
                    )
                    rec_items.append(
                        f"<li><strong>{f_name}</strong>: {rec_val} "
                        f'<span class="conf-tag">({conf_pct}% confidence)</span></li>'
                    )
                recs_html = f"""
                <div class="recs-box">
                    <div class="recs-title">Audit Recommendations:</div>
                    <ul class="recs-list">{"".join(rec_items)}</ul>
                </div>
                """

            card_html = f"""
            <div class="school-card">
                <div class="school-card-header">
                    <div class="school-meta">
                        <span class="school-num">#{idx}</span>
                        <h3 class="school-name">{s_name}</h3>
                    </div>
                    <div class="school-badges">
                        <span class="score-badge">{s_score}% Score</span>
                        <span class="status-badge {status_badge_class}">{status_label}</span>
                    </div>
                </div>

                <div class="fields-grid">
                    <div class="field-item">
                        <span class="field-label">Official Website:</span>
                        <span class="field-val">{website_html}</span>
                    </div>
                    <div class="field-item">
                        <span class="field-label">Telephone:</span>
                        <span class="field-val">{phone_val}</span>
                    </div>
                    <div class="field-item">
                        <span class="field-label">Email:</span>
                        <span class="field-val">{email_val}</span>
                    </div>
                    <div class="field-item">
                        <span class="field-label">Address:</span>
                        <span class="field-val">{address_val}</span>
                    </div>
                    <div class="field-item">
                        <span class="field-label">Grades Offered:</span>
                        <span class="field-val">{grades_val}</span>
                    </div>
                    <div class="field-item">
                        <span class="field-label">Open Enrollment:</span>
                        <span class="field-val">{open_enr_val}</span>
                    </div>
                    <div class="field-item col-span-2">
                        <span class="field-label">Programs / Co-Curricular:</span>
                        <span class="field-val">{prog_val}</span>
                    </div>
                    <div class="field-item col-span-2">
                        <span class="field-label">Factual Description:</span>
                        <span class="field-val">{desc_val}</span>
                    </div>
                </div>

                {recs_html}
            </div>
            """
            school_cards_html.append(card_html)

        html_template = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pipeline Run Report: {batch_name} ({job_id})</title>
    <style>
        :root {{
            --navy: #0A1F3C;
            --blue: #2563EB;
            --blue-light: #EFF6FF;
            --emerald: #059669;
            --emerald-light: #ECFDF5;
            --amber: #D97706;
            --amber-light: #FFFBEB;
            --slate-50: #F8FAFC;
            --slate-100: #F1F5F9;
            --slate-200: #E2E8F0;
            --slate-400: #94A3B8;
            --slate-600: #475569;
            --slate-800: #1E293B;
            --slate-900: #0F172A;
        }}
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: var(--slate-50);
            color: var(--slate-800);
            line-height: 1.5;
            padding: 32px 16px;
        }}
        .container {{
            max-width: 1040px;
            margin: 0 auto;
        }}
        /* Header Banner */
        .header-banner {{
            background: linear-gradient(135deg, #0A1F3C 0%, #173766 100%);
            color: #FFFFFF;
            border-radius: 16px;
            padding: 32px;
            margin-bottom: 24px;
            box-shadow: 0 4px 12px rgba(10, 31, 60, 0.12);
        }}
        .header-meta {{
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            flex-wrap: wrap;
            gap: 16px;
            margin-bottom: 20px;
        }}
        .brand-title {{
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: #93C5FD;
            margin-bottom: 6px;
        }}
        .report-title {{
            font-size: 26px;
            font-weight: 800;
            letter-spacing: -0.02em;
            color: #FFFFFF;
        }}
        .run-id-tag {{
            font-family: monospace;
            background: rgba(255, 255, 255, 0.12);
            border: 1px solid rgba(255, 255, 255, 0.2);
            padding: 6px 12px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
        }}
        .meta-chips {{
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            font-size: 12px;
            color: #CBD5E1;
            padding-top: 16px;
            border-top: 1px solid rgba(255, 255, 255, 0.12);
        }}
        .meta-chip strong {{ color: #FFFFFF; }}

        /* KPI Cards Grid */
        .kpi-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 16px;
            margin-bottom: 28px;
        }}
        .kpi-card {{
            background: #FFFFFF;
            border: 1px solid var(--slate-200);
            border-radius: 12px;
            padding: 18px 20px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }}
        .kpi-label {{
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--slate-600);
            margin-bottom: 4px;
        }}
        .kpi-val {{
            font-size: 24px;
            font-weight: 800;
            color: var(--slate-900);
        }}
        .kpi-sub {{
            font-size: 11px;
            color: var(--slate-400);
            margin-top: 2px;
        }}

        /* Section Heading */
        .section-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
        }}
        .section-title {{
            font-size: 17px;
            font-weight: 800;
            color: var(--slate-900);
        }}
        .section-subtitle {{
            font-size: 12px;
            color: var(--slate-600);
        }}

        /* School Card */
        .schools-list {{
            display: flex;
            flex-direction: column;
            gap: 16px;
        }}
        .school-card {{
            background: #FFFFFF;
            border: 1px solid var(--slate-200);
            border-radius: 14px;
            padding: 22px;
            box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
            page-break-inside: avoid;
        }}
        .school-card-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 12px;
            padding-bottom: 14px;
            border-bottom: 1px solid var(--slate-100);
            margin-bottom: 16px;
        }}
        .school-meta {{
            display: flex;
            align-items: center;
            gap: 10px;
        }}
        .school-num {{
            font-size: 11px;
            font-weight: 700;
            color: var(--slate-400);
            background: var(--slate-100);
            padding: 3px 8px;
            border-radius: 6px;
        }}
        .school-name {{
            font-size: 16px;
            font-weight: 700;
            color: var(--slate-900);
        }}
        .school-badges {{
            display: flex;
            align-items: center;
            gap: 8px;
        }}
        .score-badge {{
            font-size: 12px;
            font-weight: 700;
            background: var(--blue-light);
            color: var(--blue);
            padding: 4px 10px;
            border-radius: 6px;
            border: 1px solid #BFDBFE;
        }}
        .status-badge {{
            font-size: 11px;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 6px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
        }}
        .badge-verified {{
            background: var(--emerald-light);
            color: var(--emerald);
            border: 1px solid #A7F3D0;
        }}
        .badge-review {{
            background: var(--amber-light);
            color: var(--amber);
            border: 1px solid #FDE68A;
        }}

        /* Fields Grid */
        .fields-grid {{
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px 18px;
            font-size: 12px;
        }}
        @media (max-width: 640px) {{
            .fields-grid {{ grid-template-columns: 1fr; }}
            .col-span-2 {{ grid-column: span 1 !important; }}
        }}
        .col-span-2 {{
            grid-column: span 2;
        }}
        .field-item {{
            display: flex;
            flex-direction: column;
            gap: 2px;
        }}
        .field-label {{
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--slate-400);
        }}
        .field-val {{
            font-size: 12px;
            color: var(--slate-800);
            word-break: break-word;
        }}
        .field-val a {{
            color: var(--blue);
            text-decoration: none;
        }}
        .field-val a:hover {{
            text-decoration: underline;
        }}
        .empty {{
            color: var(--slate-400);
            font-style: italic;
        }}

        /* Recommendations Box */
        .recs-box {{
            margin-top: 14px;
            padding: 12px 14px;
            background: var(--slate-50);
            border: 1px solid var(--slate-200);
            border-radius: 8px;
            font-size: 12px;
        }}
        .recs-title {{
            font-size: 11px;
            font-weight: 700;
            color: var(--slate-600);
            margin-bottom: 6px;
            text-transform: uppercase;
            letter-spacing: 0.03em;
        }}
        .recs-list {{
            list-style: none;
            display: flex;
            flex-direction: column;
            gap: 4px;
        }}
        .recs-list li {{
            color: var(--slate-700);
            padding-left: 12px;
            position: relative;
        }}
        .recs-list li::before {{
            content: "•";
            position: absolute;
            left: 0;
            color: var(--blue);
            font-weight: bold;
        }}
        .conf-tag {{
            font-size: 10px;
            color: var(--slate-400);
        }}

        /* Footer */
        .footer {{
            margin-top: 36px;
            text-align: center;
            font-size: 11px;
            color: var(--slate-400);
            border-top: 1px solid var(--slate-200);
            padding-top: 20px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <header class="header-banner">
            <div class="header-meta">
                <div>
                    <div class="brand-title">SchoolPath AI Data Operations Platform • Run Report</div>
                    <h1 class="report-title">{batch_name}</h1>
                </div>
                <div class="run-id-tag">Run: {job_id}</div>
            </div>
            <div class="meta-chips">
                <div class="meta-chip">Agent: <strong>School Profile & Metadata Agent (v1.2.0)</strong></div>
                <div class="meta-chip">Model: <strong>gpt-6-luna</strong></div>
                <div class="meta-chip">Execution Date: <strong>{created_at}</strong></div>
            </div>
        </header>

        <!-- KPI Metrics -->
        <section class="kpi-grid">
            <div class="kpi-card">
                <div class="kpi-label">Schools Audited</div>
                <div class="kpi-val">{total_schools}</div>
                <div class="kpi-sub">Total batch membership</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">Verified Rate</div>
                <div class="kpi-val" style="color: var(--emerald);">{verified_rate}%</div>
                <div class="kpi-sub">{verified_count} verified • {needs_review_count} needs review</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">Average DQA Score</div>
                <div class="kpi-val" style="color: var(--blue);">{avg_score}%</div>
                <div class="kpi-sub">Quality assurance composite</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">Scraper Cache Hits</div>
                <div class="kpi-val">{cache_hits_total}</div>
                <div class="kpi-sub">Saved Firecrawl credits</div>
            </div>
        </section>

        <!-- School Outputs -->
        <section>
            <div class="section-header">
                <h2 class="section-title">School Execution Outputs ({len(schools)})</h2>
                <span class="section-subtitle">Extracted canonical attributes and DQA resolution results</span>
            </div>

            <div class="schools-list">
                {"".join(school_cards_html)}
            </div>
        </section>

        <!-- Footer -->
        <footer class="footer">
            Generated by SchoolPath AI-DOP • Standalone Executive Export • Confidential & Proprietary
        </footer>
    </div>
</body>
</html>
"""
        return html_template

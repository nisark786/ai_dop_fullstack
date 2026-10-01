"""drop_auxiliary_legacy_tables

Revision ID: 5f8a3c2e1b9d
Revises: 4e9a2b1c8f3d
Create Date: 2026-09-30 14:35:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '5f8a3c2e1b9d'
down_revision: Union[str, Sequence[str], None] = '4e9a2b1c8f3d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# 74 Auxiliary and Legacy tables not needed by the data pipeline
TABLES_TO_DROP = [
    # Admissions, Consultations & Leads
    "appointments",
    "consultant_availability",
    "consultation_queue",
    "document_uploads",
    "evidence_uploads",
    "feedback",
    "intake_submissions",
    "leads",
    "magic_links",
    "newsletter_subscriptions",
    "notifications",
    "partial_submissions",
    "qualification_submissions",
    "reminders",
    "tefa_checkpoints",
    "tefa_qualifications",
    "terms_acceptance",
    "tier_platform_config",
    # Commercial & Billing
    "placement_billing_events",
    "stripe_webhook_events",
    "school_billing_accounts",
    "school_gold_trials",
    # Content & CMS
    "blog_posts",
    "cms_pages",
    # Users, Families & Matchmaking
    "child_school_match_items",
    "child_school_match_results",
    "family_school_notes",
    "children",
    "parent_requests",
    "vendor_waitlist",
    "families",
    "users",
    # Reviews & Sentiment
    "review_themes",
    "sentiment_summaries",
    "reviews",
    # Analytics & Visitor Tracking
    "activity_logs",
    "audit_logs",
    "event_parameters",
    "message_logs",
    "user_traction",
    "visitor_events",
    "visitor_sessions",
    "visitors",
    # School Auxiliary Tags & Demand Tracking
    "saved_schools",
    "school_claim_requests",
    "school_commercial_state",
    "school_demand_daily_counts",
    "school_demand_monthly_counts",
    "school_demand_weekly_counts",
    "school_demand_yearly_counts",
    "school_event_inquiries",
    "school_events",
    "school_grade_tags",
    "school_grade_tags_legacy_osgb",
    "school_matching_bucket_tags",
    "school_matchmaking_results",
    "school_package_transitions",
    "school_pending_edits",
    "school_plan_trials",
    "school_profile_extensions",
    "school_submissions",
    "school_suggestions",
    "school_themes",
    "school_tier_history",
    "school_tier_upgrade_invites",
    "school_tiers",
    "school_tour_requests",
    "school_url_slug_redirects",
    "schools_open_seats_enroll",
    "schools_sped",
    "tour_request_notes",
    # Legacy Migration Metadata
    "admin_sql_migrations",
    "migrations",
    "typeorm_metadata",
]


def upgrade() -> None:
    """Drop non-essential auxiliary tables to streamline the database."""
    conn = op.get_bind()
    for table_name in TABLES_TO_DROP:
        conn.execute(sa_text := __import__("sqlalchemy").text(f'DROP TABLE IF EXISTS "{table_name}" CASCADE;'))


def downgrade() -> None:
    """Downgrade schema (noop as tables were legacy snapshots)."""
    pass

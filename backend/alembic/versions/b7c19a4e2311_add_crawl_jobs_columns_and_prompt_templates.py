"""add_crawl_jobs_columns_and_prompt_templates

Revision ID: b7c19a4e2311
Revises: f5b7218ac93d
Create Date: 2026-09-29 14:10:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b7c19a4e2311"
down_revision: Union[str, Sequence[str], None] = "f5b7218ac93d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add agent_name and product_name columns to crawl_jobs
    op.add_column("crawl_jobs", sa.Column("agent_name", sa.String(length=100), nullable=True))
    op.add_column("crawl_jobs", sa.Column("product_name", sa.String(length=100), nullable=True))

    # 2. Create prompt_templates table
    op.create_table(
        "prompt_templates",
        sa.Column("id", sa.String(length=50), nullable=False),
        sa.Column("product_name", sa.String(length=100), nullable=False),
        sa.Column("version", sa.String(length=50), server_default="v1.0", nullable=False),
        sa.Column("prompt_text", sa.Text(), nullable=False),
        sa.Column("approval_rate", sa.Float(), server_default="100.0", nullable=False),
        sa.Column("correction_rate", sa.Float(), server_default="0.0", nullable=False),
        sa.Column("rejection_rate", sa.Float(), server_default="0.0", nullable=False),
        sa.Column("total_evaluations", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_prompt_templates_id"), "prompt_templates", ["id"], unique=False)
    op.create_index(op.f("ix_prompt_templates_product_name"), "prompt_templates", ["product_name"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_prompt_templates_product_name"), table_name="prompt_templates")
    op.drop_index(op.f("ix_prompt_templates_id"), table_name="prompt_templates")
    op.drop_table("prompt_templates")
    op.drop_column("crawl_jobs", "product_name")
    op.drop_column("crawl_jobs", "agent_name")

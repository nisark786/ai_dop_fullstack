"""add_openai_cost_logs

Revision ID: f5b7218ac93d
Revises: e4c5f509d65b
Create Date: 2026-09-29 12:56:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f5b7218ac93d"
down_revision: Union[str, Sequence[str], None] = "e4c5f509d65b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "openai_cost_logs",
        sa.Column("id", sa.String(length=50), nullable=False),
        sa.Column("agent_name", sa.String(length=100), nullable=False),
        sa.Column("school_id", sa.String(length=100), nullable=True),
        sa.Column("batch_id", sa.String(length=100), nullable=True),
        sa.Column("task_name", sa.String(length=100), nullable=True),
        sa.Column("model", sa.String(length=100), nullable=False),
        sa.Column("prompt_tokens", sa.Integer(), server_default="0", nullable=False),
        sa.Column("completion_tokens", sa.Integer(), server_default="0", nullable=False),
        sa.Column("total_tokens", sa.Integer(), server_default="0", nullable=False),
        sa.Column("cost_usd", sa.Float(), server_default="0.0", nullable=False),
        sa.Column("duration_ms", sa.Integer(), server_default="0", nullable=False),
        sa.Column("logged_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_openai_cost_logs_agent_name"), "openai_cost_logs", ["agent_name"], unique=False)
    op.create_index(op.f("ix_openai_cost_logs_school_id"), "openai_cost_logs", ["school_id"], unique=False)
    op.create_index(op.f("ix_openai_cost_logs_batch_id"), "openai_cost_logs", ["batch_id"], unique=False)
    op.create_index(op.f("ix_openai_cost_logs_logged_at"), "openai_cost_logs", ["logged_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_openai_cost_logs_logged_at"), table_name="openai_cost_logs")
    op.drop_index(op.f("ix_openai_cost_logs_batch_id"), table_name="openai_cost_logs")
    op.drop_index(op.f("ix_openai_cost_logs_school_id"), table_name="openai_cost_logs")
    op.drop_index(op.f("ix_openai_cost_logs_agent_name"), table_name="openai_cost_logs")
    op.drop_table("openai_cost_logs")

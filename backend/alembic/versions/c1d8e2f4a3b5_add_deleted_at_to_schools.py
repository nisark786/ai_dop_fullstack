"""add_deleted_at_to_schools

Revision ID: c1d8e2f4a3b5
Revises: 2b5010c3b19c
Create Date: 2026-09-30 13:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1d8e2f4a3b5'
down_revision: Union[str, Sequence[str], None] = '2b5010c3b19c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('schools', sa.Column('deleted_at', sa.DateTime(), nullable=True))
    op.create_index(op.f('ix_schools_deleted_at'), 'schools', ['deleted_at'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_schools_deleted_at'), table_name='schools')
    op.drop_column('schools', 'deleted_at')

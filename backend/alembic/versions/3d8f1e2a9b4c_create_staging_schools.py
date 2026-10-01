"""create_staging_schools

Revision ID: 3d8f1e2a9b4c
Revises: c1d8e2f4a3b5
Create Date: 2026-09-30 14:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '3d8f1e2a9b4c'
down_revision: Union[str, Sequence[str], None] = 'c1d8e2f4a3b5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'staging_schools',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('batch_id', sa.Uuid(), nullable=False),
        sa.Column('production_school_id', sa.Uuid(), nullable=True),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('website', sa.Text(), nullable=True),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('district', sa.String(length=255), nullable=True),
        sa.Column('state', sa.String(length=50), nullable=True),
        sa.Column('phone', sa.String(length=50), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('type', postgresql.JSONB(astext_type=sa.Text()).with_variant(sa.JSON(), 'sqlite'), nullable=True),
        sa.Column('grades', postgresql.JSONB(astext_type=sa.Text()).with_variant(sa.JSON(), 'sqlite'), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='pending'),
        sa.Column('source_data', postgresql.JSONB(astext_type=sa.Text()).with_variant(sa.JSON(), 'sqlite'), nullable=True),
        sa.Column('metadata_json', postgresql.JSONB(astext_type=sa.Text()).with_variant(sa.JSON(), 'sqlite'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['batch_id'], ['batches.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['production_school_id'], ['schools.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_staging_schools_batch_id'), 'staging_schools', ['batch_id'], unique=False)
    op.create_index(op.f('ix_staging_schools_production_school_id'), 'staging_schools', ['production_school_id'], unique=False)
    op.create_index(op.f('ix_staging_schools_name'), 'staging_schools', ['name'], unique=False)
    op.create_index(op.f('ix_staging_schools_district'), 'staging_schools', ['district'], unique=False)
    op.create_index(op.f('ix_staging_schools_status'), 'staging_schools', ['status'], unique=False)
    op.create_index(op.f('ix_staging_schools_deleted_at'), 'staging_schools', ['deleted_at'], unique=False)
    op.create_index('ix_staging_schools_batch_name', 'staging_schools', ['batch_id', 'name'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_staging_schools_batch_name', table_name='staging_schools')
    op.drop_index(op.f('ix_staging_schools_deleted_at'), table_name='staging_schools')
    op.drop_index(op.f('ix_staging_schools_status'), table_name='staging_schools')
    op.drop_index(op.f('ix_staging_schools_district'), table_name='staging_schools')
    op.drop_index(op.f('ix_staging_schools_name'), table_name='staging_schools')
    op.drop_index(op.f('ix_staging_schools_production_school_id'), table_name='staging_schools')
    op.drop_index(op.f('ix_staging_schools_batch_id'), table_name='staging_schools')
    op.drop_table('staging_schools')

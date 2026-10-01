"""add_staging_school_id_to_outputs_and_evidence

Revision ID: 4e9a2b1c8f3d
Revises: 3d8f1e2a9b4c
Create Date: 2026-09-30 14:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4e9a2b1c8f3d'
down_revision: Union[str, Sequence[str], None] = '3d8f1e2a9b4c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Update metadata_agent_outputs
    with op.batch_alter_table('metadata_agent_outputs', schema=None) as batch_op:
        batch_op.add_column(sa.Column('staging_school_id', sa.Uuid(), nullable=True))
        batch_op.alter_column('school_id', existing_type=sa.Uuid(), nullable=True)
        batch_op.create_foreign_key(
            'fk_metadata_outputs_staging_school',
            'staging_schools',
            ['staging_school_id'],
            ['id'],
            ondelete='CASCADE'
        )
        batch_op.create_index('ix_metadata_agent_outputs_staging_school_id', ['staging_school_id'], unique=False)

    # 2. Update evidence_records
    with op.batch_alter_table('evidence_records', schema=None) as batch_op:
        batch_op.add_column(sa.Column('staging_school_id', sa.Uuid(), nullable=True))
        batch_op.alter_column('school_id', existing_type=sa.Uuid(), nullable=True)
        batch_op.create_foreign_key(
            'fk_evidence_records_staging_school',
            'staging_schools',
            ['staging_school_id'],
            ['id'],
            ondelete='CASCADE'
        )
        batch_op.create_index('ix_evidence_records_staging_school_id', ['staging_school_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('evidence_records', schema=None) as batch_op:
        batch_op.drop_index('ix_evidence_records_staging_school_id')
        batch_op.drop_constraint('fk_evidence_records_staging_school', type_='foreignkey')
        batch_op.drop_column('staging_school_id')
        batch_op.alter_column('school_id', existing_type=sa.Uuid(), nullable=False)

    with op.batch_alter_table('metadata_agent_outputs', schema=None) as batch_op:
        batch_op.drop_index('ix_metadata_agent_outputs_staging_school_id')
        batch_op.drop_constraint('fk_metadata_outputs_staging_school', type_='foreignkey')
        batch_op.drop_column('staging_school_id')
        batch_op.alter_column('school_id', existing_type=sa.Uuid(), nullable=False)

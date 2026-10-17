"""mutation hearing date (hearing calendar)

Revision ID: 0014
Revises: 0013
Create Date: 2026-10-17 00:00:00
"""
from alembic import op
import sqlalchemy as sa


revision = '0014'
down_revision = '0013'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('mutation_records') as batch:
        batch.add_column(sa.Column('hearing_at', sa.DateTime(timezone=True), nullable=True))
        batch.create_index('ix_mutation_records_hearing_at', ['hearing_at'])


def downgrade() -> None:
    with op.batch_alter_table('mutation_records') as batch:
        batch.drop_index('ix_mutation_records_hearing_at')
        batch.drop_column('hearing_at')

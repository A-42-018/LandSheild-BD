"""ownership_history.kind: CURRENT | HISTORICAL (chain-of-title links from historical deeds, H9a)

Revision ID: 0018
Revises: 0017
Create Date: 2026-10-18 00:00:00
"""
from alembic import op
import sqlalchemy as sa


revision = '0018'
down_revision = '0017'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('ownership_history') as batch:
        batch.add_column(
            sa.Column('kind', sa.String(length=12), nullable=False, server_default='CURRENT')
        )


def downgrade() -> None:
    with op.batch_alter_table('ownership_history') as batch:
        batch.drop_column('kind')

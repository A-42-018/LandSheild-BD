"""hash-chained ledger entries

Revision ID: 0007
Revises: 0006
Create Date: 2026-10-06 00:00:00
"""
from alembic import op
import sqlalchemy as sa


revision = '0007'
down_revision = '0006'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'ledger_entries',
        sa.Column('seq', sa.Integer(), nullable=False),
        sa.Column('entity_type', sa.String(length=20), nullable=False),
        sa.Column('entity_id', sa.String(length=36), nullable=False),
        sa.Column('payload_hash', sa.String(length=64), nullable=False),
        sa.Column('prev_hash', sa.String(length=64), nullable=False),
        sa.Column('entry_hash', sa.String(length=64), nullable=False),
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_ledger_entries_seq', 'ledger_entries', ['seq'], unique=True)
    op.create_index('ix_ledger_entries_entity', 'ledger_entries', ['entity_type', 'entity_id'])


def downgrade() -> None:
    op.drop_index('ix_ledger_entries_entity', table_name='ledger_entries')
    op.drop_index('ix_ledger_entries_seq', table_name='ledger_entries')
    op.drop_table('ledger_entries')

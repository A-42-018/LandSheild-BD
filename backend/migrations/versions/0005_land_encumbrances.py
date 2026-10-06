"""land encumbrances

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-06 00:00:00
"""
from alembic import op
import sqlalchemy as sa


revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('land_encumbrances',
    sa.Column('land_id', sa.String(length=36), nullable=False),
    sa.Column('type', sa.String(length=20), nullable=False),
    sa.Column('reference_no', sa.String(length=60), nullable=False),
    sa.Column('authority', sa.String(length=120), nullable=True),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('started_at', sa.Date(), nullable=True),
    sa.Column('resolved_at', sa.Date(), nullable=True),
    sa.Column('note', sa.String(length=255), nullable=True),
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['land_id'], ['land_parcels.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('land_encumbrances', schema=None) as batch_op:
        batch_op.create_index('ix_land_encumbrances_land_id', ['land_id'], unique=False)
        batch_op.create_index('ix_land_encumbrances_type', ['type'], unique=False)
        batch_op.create_index('ix_land_encumbrances_status', ['status'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('land_encumbrances', schema=None) as batch_op:
        batch_op.drop_index('ix_land_encumbrances_status')
        batch_op.drop_index('ix_land_encumbrances_type')
        batch_op.drop_index('ix_land_encumbrances_land_id')

    op.drop_table('land_encumbrances')

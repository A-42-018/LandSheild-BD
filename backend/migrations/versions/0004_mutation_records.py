"""mutation records

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-06 00:00:00
"""
from alembic import op
import sqlalchemy as sa


revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('mutation_records',
    sa.Column('mutation_no', sa.String(length=50), nullable=False),
    sa.Column('land_id', sa.String(length=36), nullable=False),
    sa.Column('deed_id', sa.String(length=36), nullable=True),
    sa.Column('transaction_id', sa.String(length=36), nullable=True),
    sa.Column('applicant_owner_id', sa.String(length=36), nullable=False),
    sa.Column('previous_khatian_no', sa.String(length=50), nullable=True),
    sa.Column('new_khatian_no', sa.String(length=50), nullable=True),
    sa.Column('area', sa.Float(), nullable=False),
    sa.Column('area_unit', sa.String(length=20), nullable=False),
    sa.Column('ac_land_office', sa.String(length=120), nullable=True),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('checklist', sa.JSON(), nullable=True),
    sa.Column('fast_track', sa.Boolean(), nullable=False),
    sa.Column('applied_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('decided_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('status_changed_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('source', sa.String(length=20), nullable=False),
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['applicant_owner_id'], ['owners.id'], ),
    sa.ForeignKeyConstraint(['deed_id'], ['deeds.id'], ),
    sa.ForeignKeyConstraint(['land_id'], ['land_parcels.id'], ),
    sa.ForeignKeyConstraint(['transaction_id'], ['transactions.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('mutation_no')
    )
    with op.batch_alter_table('mutation_records', schema=None) as batch_op:
        batch_op.create_index('ix_mutation_records_land_id', ['land_id'], unique=False)
        batch_op.create_index('ix_mutation_records_deed_id', ['deed_id'], unique=False)
        batch_op.create_index('ix_mutation_records_transaction_id', ['transaction_id'], unique=False)
        batch_op.create_index('ix_mutation_records_applicant_owner_id', ['applicant_owner_id'], unique=False)
        batch_op.create_index('ix_mutation_records_status', ['status'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('mutation_records', schema=None) as batch_op:
        batch_op.drop_index('ix_mutation_records_status')
        batch_op.drop_index('ix_mutation_records_applicant_owner_id')
        batch_op.drop_index('ix_mutation_records_transaction_id')
        batch_op.drop_index('ix_mutation_records_deed_id')
        batch_op.drop_index('ix_mutation_records_land_id')

    op.drop_table('mutation_records')

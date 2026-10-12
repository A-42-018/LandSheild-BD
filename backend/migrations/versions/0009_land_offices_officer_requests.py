"""land_offices, officer_requests, users.office_id

Revision ID: 0009
Revises: 0008
Create Date: 2026-10-13 00:00:00
"""
from alembic import op
import sqlalchemy as sa


revision = '0009'
down_revision = '0008'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'land_offices',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('code', sa.String(length=20), nullable=False),
        sa.Column('office_type', sa.String(length=40), nullable=False),
        sa.Column('division_en', sa.String(length=100), nullable=False),
        sa.Column('division_bn', sa.String(length=100), nullable=False),
        sa.Column('district_en', sa.String(length=100), nullable=False),
        sa.Column('district_bn', sa.String(length=100), nullable=False),
        sa.Column('upazila_en', sa.String(length=100), nullable=True),
        sa.Column('upazila_bn', sa.String(length=100), nullable=True),
        sa.Column('union_en', sa.String(length=100), nullable=True),
        sa.Column('union_bn', sa.String(length=100), nullable=True),
        sa.Column('name_en', sa.String(length=255), nullable=False),
        sa.Column('name_bn', sa.String(length=255), nullable=False),
        sa.Column('location', sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code'),
    )
    op.create_index('ix_land_offices_division_en', 'land_offices', ['division_en'])
    op.create_index('ix_land_offices_district_en', 'land_offices', ['district_en'])
    op.create_index('ix_land_offices_upazila_en', 'land_offices', ['upazila_en'])
    op.create_table(
        'officer_requests',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('office_id', sa.String(length=36), nullable=False),
        sa.Column('designation', sa.String(length=100), nullable=False),
        sa.Column('phone', sa.String(length=30), nullable=False),
        sa.Column('employee_id', sa.String(length=50), nullable=False),
        sa.Column('proof_note', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('reviewed_by', sa.String(length=36), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('rejection_reason', sa.String(length=500), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['office_id'], ['land_offices.id']),
        sa.ForeignKeyConstraint(['reviewed_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_officer_requests_user_id', 'officer_requests', ['user_id'])
    op.create_index('ix_officer_requests_status', 'officer_requests', ['status'])
    with op.batch_alter_table('users') as batch:
        batch.add_column(sa.Column('office_id', sa.String(length=36), nullable=True))
        batch.create_foreign_key('fk_users_office_id', 'land_offices', ['office_id'], ['id'])


def downgrade() -> None:
    with op.batch_alter_table('users') as batch:
        batch.drop_constraint('fk_users_office_id', type_='foreignkey')
        batch.drop_column('office_id')
    op.drop_index('ix_officer_requests_status', table_name='officer_requests')
    op.drop_index('ix_officer_requests_user_id', table_name='officer_requests')
    op.drop_table('officer_requests')
    op.drop_index('ix_land_offices_upazila_en', table_name='land_offices')
    op.drop_index('ix_land_offices_district_en', table_name='land_offices')
    op.drop_index('ix_land_offices_division_en', table_name='land_offices')
    op.drop_table('land_offices')

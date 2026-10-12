"""documents.office_id, land_parcels.office_id/union: records live in one land office

Revision ID: 0010
Revises: 0009
Create Date: 2026-10-13 01:00:00
"""
from alembic import op
import sqlalchemy as sa


revision = '0010'
down_revision = '0009'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('documents') as batch:
        batch.add_column(sa.Column('office_id', sa.String(length=36), nullable=True))
        batch.create_index('ix_documents_office_id', ['office_id'])
        batch.create_foreign_key('fk_documents_office_id', 'land_offices', ['office_id'], ['id'])
    with op.batch_alter_table('land_parcels') as batch:
        batch.add_column(sa.Column('office_id', sa.String(length=36), nullable=True))
        batch.add_column(sa.Column('union', sa.String(length=100), nullable=True))
        batch.create_index('ix_land_parcels_office_id', ['office_id'])
        batch.create_foreign_key('fk_land_parcels_office_id', 'land_offices', ['office_id'], ['id'])


def downgrade() -> None:
    with op.batch_alter_table('land_parcels') as batch:
        batch.drop_constraint('fk_land_parcels_office_id', type_='foreignkey')
        batch.drop_index('ix_land_parcels_office_id')
        batch.drop_column('union')
        batch.drop_column('office_id')
    with op.batch_alter_table('documents') as batch:
        batch.drop_constraint('fk_documents_office_id', type_='foreignkey')
        batch.drop_index('ix_documents_office_id')
        batch.drop_column('office_id')

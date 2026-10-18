"""document_records (versioned digital records), deeds.is_historical + deeds.record_id

Revision ID: 0017
Revises: 0016
Create Date: 2026-10-18 00:00:00
"""
from alembic import op
import sqlalchemy as sa


revision = '0017'
down_revision = '0016'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'document_records',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('document_id', sa.String(length=36), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('schema', sa.String(length=20), nullable=False),
        sa.Column('record_json', sa.JSON(), nullable=False),
        sa.Column('created_by', sa.String(length=36), nullable=True),
        sa.Column('approved_by', sa.String(length=36), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('record_hash', sa.String(length=64), nullable=True),
        sa.Column('signature', sa.String(length=128), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], name='fk_document_records_document_id'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], name='fk_document_records_created_by'),
        sa.ForeignKeyConstraint(['approved_by'], ['users.id'], name='fk_document_records_approved_by'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('document_id', 'version', name='uq_document_records_version'),
    )
    op.create_index('ix_document_records_document_id', 'document_records', ['document_id'])
    with op.batch_alter_table('deeds') as batch:
        batch.add_column(sa.Column('is_historical', sa.Boolean(), nullable=False, server_default=sa.false()))
        batch.add_column(sa.Column('record_id', sa.String(length=36), nullable=True))
        batch.create_foreign_key('fk_deeds_record_id', 'document_records', ['record_id'], ['id'])


def downgrade() -> None:
    with op.batch_alter_table('deeds') as batch:
        batch.drop_constraint('fk_deeds_record_id', type_='foreignkey')
        batch.drop_column('record_id')
        batch.drop_column('is_historical')
    op.drop_index('ix_document_records_document_id', table_name='document_records')
    op.drop_table('document_records')

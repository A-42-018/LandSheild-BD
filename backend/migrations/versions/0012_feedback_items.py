"""feedback_items: public feedback, grievances and page ratings

Revision ID: 0012
Revises: 0011
Create Date: 2026-10-14 00:00:00
"""
from alembic import op
import sqlalchemy as sa


revision = '0012'
down_revision = '0011'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'feedback_items',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('reference_no', sa.String(length=30), nullable=False),
        sa.Column('kind', sa.String(length=20), nullable=False),
        sa.Column('subject', sa.String(length=200), nullable=False),
        sa.Column('message', sa.String(length=2000), nullable=False),
        sa.Column('contact_email', sa.String(length=255), nullable=True),
        sa.Column('related_ref', sa.String(length=100), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('response', sa.String(length=1000), nullable=True),
        sa.Column('responded_by', sa.String(length=36), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['responded_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('reference_no'),
    )
    op.create_index('ix_feedback_items_status', 'feedback_items', ['status'])
    op.create_index('ix_feedback_items_kind', 'feedback_items', ['kind'])


def downgrade() -> None:
    op.drop_index('ix_feedback_items_kind', table_name='feedback_items')
    op.drop_index('ix_feedback_items_status', table_name='feedback_items')
    op.drop_table('feedback_items')

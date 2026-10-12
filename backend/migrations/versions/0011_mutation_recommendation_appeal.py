"""mutation_records: union recommendation, decider, appeal

Revision ID: 0011
Revises: 0010
Create Date: 2026-10-13 02:00:00
"""
from alembic import op
import sqlalchemy as sa


revision = '0011'
down_revision = '0010'
branch_labels = None
depends_on = None

_USER_FKS = ('recommended_by', 'decided_by', 'appealed_by')


def upgrade() -> None:
    with op.batch_alter_table('mutation_records') as batch:
        batch.add_column(sa.Column('recommendation', sa.String(length=10), nullable=True))
        batch.add_column(sa.Column('recommendation_note', sa.String(length=500), nullable=True))
        batch.add_column(sa.Column('recommended_by', sa.String(length=36), nullable=True))
        batch.add_column(sa.Column('recommended_at', sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column('decided_by', sa.String(length=36), nullable=True))
        batch.add_column(sa.Column('appeal_reason', sa.String(length=500), nullable=True))
        batch.add_column(sa.Column('appealed_by', sa.String(length=36), nullable=True))
        batch.add_column(sa.Column('appealed_at', sa.DateTime(timezone=True), nullable=True))
        for col in _USER_FKS:
            batch.create_foreign_key(f'fk_mutation_records_{col}', 'users', [col], ['id'])


def downgrade() -> None:
    with op.batch_alter_table('mutation_records') as batch:
        for col in _USER_FKS:
            batch.drop_constraint(f'fk_mutation_records_{col}', type_='foreignkey')
        for col in ('appealed_at', 'appealed_by', 'appeal_reason', 'decided_by', 'recommended_at',
                    'recommended_by', 'recommendation_note', 'recommendation'):
            batch.drop_column(col)

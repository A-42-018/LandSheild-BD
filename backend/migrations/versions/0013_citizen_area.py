"""citizen area: search_history, watchlist, notifications, users.phone

Revision ID: 0013
Revises: 0012
Create Date: 2026-10-17 00:00:00
"""
from alembic import op
import sqlalchemy as sa


revision = '0013'
down_revision = '0012'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('users') as batch:
        batch.add_column(sa.Column('phone', sa.String(length=20), nullable=True))

    op.create_table(
        'search_history',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('land_id', sa.String(length=36), nullable=False),
        sa.Column('search_count', sa.Integer(), nullable=False),
        sa.Column('last_searched_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['land_id'], ['land_parcels.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'land_id', name='uq_search_history_user_land'),
    )
    op.create_index('ix_search_history_user_last', 'search_history', ['user_id', 'last_searched_at'])

    op.create_table(
        'watchlist',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('land_id', sa.String(length=36), nullable=False),
        sa.Column('note', sa.String(length=100), nullable=True),
        sa.Column('checked_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['land_id'], ['land_parcels.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'land_id', name='uq_watchlist_user_land'),
    )
    op.create_index('ix_watchlist_user_id', 'watchlist', ['user_id'])

    op.create_table(
        'notifications',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('kind', sa.String(length=40), nullable=False),
        sa.Column('land_id', sa.String(length=64), nullable=True),
        sa.Column('ref_id', sa.String(length=36), nullable=True),
        sa.Column('data', sa.JSON(), nullable=True),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_notifications_user_created', 'notifications', ['user_id', 'created_at'])


def downgrade() -> None:
    op.drop_index('ix_notifications_user_created', table_name='notifications')
    op.drop_table('notifications')
    op.drop_index('ix_watchlist_user_id', table_name='watchlist')
    op.drop_table('watchlist')
    op.drop_index('ix_search_history_user_last', table_name='search_history')
    op.drop_table('search_history')
    with op.batch_alter_table('users') as batch:
        batch.drop_column('phone')

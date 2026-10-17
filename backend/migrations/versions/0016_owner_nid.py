"""owner NID: users.nid_* (citizen's linked NID), owners.dob_hash, documents.party_nids

Revision ID: 0016
Revises: 0015
Create Date: 2026-10-17 00:00:00
"""
from alembic import op
import sqlalchemy as sa


revision = '0016'
down_revision = '0015'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('users') as batch:
        batch.add_column(sa.Column('nid_hash', sa.String(length=128), nullable=True))
        batch.add_column(sa.Column('nid_last4', sa.String(length=4), nullable=True))
        batch.add_column(sa.Column('nid_verified_at', sa.DateTime(timezone=True), nullable=True))
        batch.create_unique_constraint('uq_users_nid_hash', ['nid_hash'])
    with op.batch_alter_table('owners') as batch:
        batch.add_column(sa.Column('dob_hash', sa.String(length=128), nullable=True))
        batch.create_unique_constraint('uq_owners_nid_hash', ['nid_hash'])
    with op.batch_alter_table('documents') as batch:
        batch.add_column(sa.Column('party_nids', sa.JSON(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('documents') as batch:
        batch.drop_column('party_nids')
    with op.batch_alter_table('owners') as batch:
        batch.drop_constraint('uq_owners_nid_hash', type_='unique')
        batch.drop_column('dob_hash')
    with op.batch_alter_table('users') as batch:
        batch.drop_constraint('uq_users_nid_hash', type_='unique')
        batch.drop_column('nid_verified_at')
        batch.drop_column('nid_last4')
        batch.drop_column('nid_hash')

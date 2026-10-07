"""audit_logs.actor_role: the actor's role when the action happened

Revision ID: 0008
Revises: 0007
Create Date: 2026-10-07 00:00:00
"""
from alembic import op
import sqlalchemy as sa


revision = '0008'
down_revision = '0007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('audit_logs') as batch:
        batch.add_column(sa.Column('actor_role', sa.String(length=20), nullable=True))
    # existing rows: best effort, the role the actor has now (the historic one was never stored)
    op.execute(
        "UPDATE audit_logs SET actor_role = "
        "(SELECT role FROM users WHERE users.id = audit_logs.actor_id) "
        "WHERE actor_id IS NOT NULL"
    )


def downgrade() -> None:
    with op.batch_alter_table('audit_logs') as batch:
        batch.drop_column('actor_role')

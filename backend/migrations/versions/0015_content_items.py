"""content_items: admin-managed notices, FAQ entries and guides (seeded with the four demo notices)

Revision ID: 0015
Revises: 0014
Create Date: 2026-10-17 00:00:00
"""
import uuid
from datetime import UTC, date, datetime

from alembic import op
import sqlalchemy as sa


revision = '0015'
down_revision = '0014'
branch_labels = None
depends_on = None

# (date, ticker, title_en, title_bn, body_en, body_bn): the notices the home page showed as static text
NOTICES = [
    ("2026-10-14", True, "Check before you buy lists khas land and acquisition",
     "কেনার আগে যাচাইয়ে খাস জমি ও অধিগ্রহণ যুক্ত হয়েছে",
     "Plots on khas land or under acquisition now show as a red flag.",
     "খাস জমি বা অধিগ্রহণাধীন দাগ এখন সতর্ক সংকেত হিসেবে দেখা যায়।"),
    ("2026-10-12", True, "Track a mutation without signing in",
     "সাইন ইন ছাড়াই নামজারির অবস্থা",
     "Anyone can follow an application by its number.",
     "আবেদনের নম্বর দিয়ে যে কেউ অবস্থা অনুসরণ করতে পারেন।"),
    ("2026-10-07", False, "Role-based access reviewed",
     "ভূমিকাভিত্তিক প্রবেশাধিকার পর্যালোচিত",
     "Sign-in roles and the four-eyes approval rule were checked on every page.",
     "প্রতিটি পাতায় কে কী দেখতে পারেন তা পরীক্ষা করা হয়েছে। অনুমোদনে দুজন আলাদা মানুষ লাগে।"),
    ("2026-10-06", True, "Citizen tools added",
     "নতুন হিসাব-সহায়ক যুক্ত হয়েছে",
     "Land unit converter, fee calculator and inheritance shares.",
     "জমির একক বদল, ফি-র হিসাব ও উত্তরাধিকারের অংশ।"),
]


def upgrade() -> None:
    table = op.create_table(
        'content_items',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('kind', sa.String(length=10), nullable=False),
        sa.Column('title_en', sa.String(length=200), nullable=False),
        sa.Column('title_bn', sa.String(length=200), nullable=False),
        sa.Column('body_en', sa.Text(), nullable=False),
        sa.Column('body_bn', sa.Text(), nullable=False),
        sa.Column('published_on', sa.Date(), nullable=True),
        sa.Column('ticker', sa.Boolean(), nullable=False),
        sa.Column('published', sa.Boolean(), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.Column('updated_by', sa.String(length=36), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_content_items_kind_published', 'content_items', ['kind', 'published'])
    now = datetime.now(UTC)
    op.bulk_insert(table, [
        {
            'id': str(uuid.uuid4()), 'kind': 'NOTICE', 'title_en': te, 'title_bn': tb,
            'body_en': be, 'body_bn': bb, 'published_on': date.fromisoformat(d),
            'ticker': tk, 'published': True, 'position': 0, 'updated_by': None,
            'created_at': now, 'updated_at': now,
        }
        for d, tk, te, tb, be, bb in NOTICES
    ])


def downgrade() -> None:
    op.drop_index('ix_content_items_kind_published', table_name='content_items')
    op.drop_table('content_items')

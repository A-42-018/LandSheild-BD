"""land_parcels: survey_type, jl_no, map_sheet_no + unique key per survey/JL (SJ1)

Revision ID: 0019
Revises: 0018
Create Date: 2026-10-19 00:00:00
"""
import json

from alembic import op
import sqlalchemy as sa


revision = '0019'
down_revision = '0018'
branch_labels = None
depends_on = None

OLD_KEY = ('district', 'upazila', 'mouza', 'khatian_no', 'dag_no')
NEW_KEY = ('district', 'upazila', 'jl_no', 'mouza', 'survey_type', 'khatian_no', 'dag_no')


def _backfill() -> None:
    """survey_type / jl_no from each parcel's newest khatian/porcha extraction (else stay NULL)."""
    bind = op.get_bind()
    docs = sa.table(
        'documents',
        sa.column('land_id'), sa.column('document_type'),
        sa.column('extraction_json'), sa.column('created_at'),
    )
    parcels = sa.table(
        'land_parcels', sa.column('id'), sa.column('survey_type'), sa.column('jl_no')
    )
    rows = bind.execute(
        sa.select(docs.c.land_id, docs.c.extraction_json)
        .where(docs.c.land_id.isnot(None), docs.c.document_type.in_(('KHATIAN', 'PORCHA')))
        .order_by(docs.c.created_at.desc())
    ).all()
    seen: set[str] = set()
    for land_id, ex in rows:  # newest first: the first hit per parcel wins
        if land_id in seen:
            continue
        if isinstance(ex, str):
            try:
                ex = json.loads(ex)
            except ValueError:
                ex = None
        if not isinstance(ex, dict):
            continue
        survey = ex.get('survey_type')
        jl = (ex.get('extras') or {}).get('jl_no')
        survey = survey if survey in ('CS', 'SA', 'RS', 'BS') else None
        jl = str(jl).strip().lstrip('0') or None if jl not in (None, '') else None
        if survey is None and jl is None:
            continue
        seen.add(land_id)
        bind.execute(
            parcels.update().where(parcels.c.id == land_id).values(survey_type=survey, jl_no=jl)
        )


def upgrade() -> None:
    with op.batch_alter_table('land_parcels') as batch:
        batch.add_column(sa.Column('survey_type', sa.String(length=2), nullable=True))
        batch.add_column(sa.Column('jl_no', sa.String(length=20), nullable=True))
        batch.add_column(sa.Column('map_sheet_no', sa.String(length=20), nullable=True))
    _backfill()
    with op.batch_alter_table('land_parcels') as batch:
        batch.drop_constraint('uq_land_parcel_identifiers', type_='unique')
        batch.create_unique_constraint('uq_land_parcel_identifiers', list(NEW_KEY))
        batch.create_index('ix_land_parcels_mouza_jl', ['mouza', 'jl_no'])


def downgrade() -> None:
    with op.batch_alter_table('land_parcels') as batch:
        batch.drop_index('ix_land_parcels_mouza_jl')
        batch.drop_constraint('uq_land_parcel_identifiers', type_='unique')
        batch.create_unique_constraint('uq_land_parcel_identifiers', list(OLD_KEY))
        batch.drop_column('map_sheet_no')
        batch.drop_column('jl_no')
        batch.drop_column('survey_type')

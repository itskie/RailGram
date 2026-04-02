"""add_spatial_index_cell_tower_calibration

Adds a composite index on (latitude, longitude) for cell_tower_calibration
to support fast geo-range queries used by the offline triangulation export
and any future spatial lookups.

Revision ID: a3f7e2b1c9d0
Revises: f0ll0wr3qu35t, f1a2b3c4d5e6
Create Date: 2026-04-02 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'a3f7e2b1c9d0'
down_revision: Union[str, tuple] = ('f0ll0wr3qu35t', 'f1a2b3c4d5e6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        'ix_cell_tower_calibration_location',
        'cell_tower_calibration',
        ['latitude', 'longitude'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        'ix_cell_tower_calibration_location',
        table_name='cell_tower_calibration',
    )

"""merge_cell_tower_and_chat_branches

Revision ID: de2ca6484082
Revises: 9f2a8b1c3d4e, fade3c65e923
Create Date: 2026-03-28 04:07:59.506624

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'de2ca6484082'
down_revision: Union[str, None] = ('9f2a8b1c3d4e', 'fade3c65e923')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass

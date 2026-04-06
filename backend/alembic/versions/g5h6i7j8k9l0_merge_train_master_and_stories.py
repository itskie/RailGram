"""Merge train_master and stories branches

Revision ID: g5h6i7j8k9l0
Revises: d2e3f4a5b6c7, f4a5b6c7d8e9
Create Date: 2026-04-06 15:00:00.000000

"""
from typing import Sequence, Union

revision: str = "g5h6i7j8k9l0"
down_revision: Union[str, Sequence[str], None] = ("d2e3f4a5b6c7", "f4a5b6c7d8e9")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

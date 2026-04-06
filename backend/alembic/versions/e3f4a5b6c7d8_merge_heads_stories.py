"""Merge heads for stories migrations

Revision ID: e3f4a5b6c7d8
Revises: a9b8c7d6e5f4, a3f7e2b1c9d0
Create Date: 2026-04-06 14:00:00.000000

"""
from typing import Sequence, Union

revision: str = "e3f4a5b6c7d8"
down_revision: Union[str, Sequence[str], None] = ("a9b8c7d6e5f4", "a3f7e2b1c9d0")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

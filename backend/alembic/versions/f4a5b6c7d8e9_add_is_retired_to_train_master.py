"""add is_retired to train_master

Revision ID: f4a5b6c7d8e9
Revises: f2a3b4c5d6e7
Create Date: 2026-04-04

"""
from alembic import op
import sqlalchemy as sa

revision = 'f4a5b6c7d8e9'
down_revision = 'f2a3b4c5d6e7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('train_master', sa.Column('is_retired', sa.Boolean(), server_default='false', nullable=False))


def downgrade() -> None:
    op.drop_column('train_master', 'is_retired')

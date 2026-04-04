"""add is_retired to train_master

Revision ID: b1c2d3e4f5a6
Revises: f2a3b4c5d6e7
Create Date: 2026-04-04

"""
from alembic import op
import sqlalchemy as sa

revision = 'b1c2d3e4f5a6'
down_revision = 'f2a3b4c5d6e7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('train_master', sa.Column('is_retired', sa.Boolean(), server_default='false', nullable=False))


def downgrade() -> None:
    op.drop_column('train_master', 'is_retired')

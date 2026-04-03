"""add karma index for leaderboard performance

Revision ID: e7f8a9b0c1d2
Revises: f1a2b3c4d5e6
Create Date: 2026-04-03

"""
from alembic import op

revision = 'e7f8a9b0c1d2'
down_revision = 'f1a2b3c4d5e6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index('ix_user_karma', 'users', ['karma'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_user_karma', table_name='users')

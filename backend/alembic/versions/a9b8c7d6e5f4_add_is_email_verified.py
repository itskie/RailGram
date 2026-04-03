"""add is_email_verified to users

Revision ID: a9b8c7d6e5f4
Revises: f2a3b4c5d6e7
Create Date: 2026-04-03

"""
import sqlalchemy as sa
from alembic import op

revision = 'a9b8c7d6e5f4'
down_revision = 'f2a3b4c5d6e7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Copy existing is_verified values into new is_email_verified column
    # (existing verified users had verified their email)
    op.add_column('users', sa.Column('is_email_verified', sa.Boolean(), nullable=False, server_default='false'))
    # Backfill: anyone who was already is_verified=true had verified their email
    op.execute("UPDATE users SET is_email_verified = is_verified")


def downgrade() -> None:
    op.drop_column('users', 'is_email_verified')

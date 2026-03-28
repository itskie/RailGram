"""add email_tokens table

Revision ID: a1b2c3d4e5f6
Revises: de2ca6484082
Create Date: 2026-03-28 11:46:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'de2ca6484082'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'email_tokens',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('token', sa.String(length=128), nullable=False),
        sa.Column('type', sa.String(length=30), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_email_tokens_token', 'email_tokens', ['token'], unique=True)
    op.create_index('ix_email_tokens_user_id', 'email_tokens', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_email_tokens_user_id', table_name='email_tokens')
    op.drop_index('ix_email_tokens_token', table_name='email_tokens')
    op.drop_table('email_tokens')

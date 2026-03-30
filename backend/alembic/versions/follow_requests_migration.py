"""add follow_requests table

Revision ID: f0ll0wr3qu35t
Revises: fade3c65e923
Create Date: 2026-03-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'f0ll0wr3qu35t'
down_revision: Union[str, None] = 'fade3c65e923'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('follow_requests',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('follower_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('followed_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['follower_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['followed_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('follower_id', 'followed_id', name='uq_follow_request')
    )
    op.create_index('ix_follow_requests_follower_id', 'follow_requests', ['follower_id'], unique=False)
    op.create_index('ix_follow_requests_followed_id', 'follow_requests', ['followed_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_follow_requests_followed_id', table_name='follow_requests')
    op.drop_index('ix_follow_requests_follower_id', table_name='follow_requests')
    op.drop_table('follow_requests')

"""add comment likes and reel comment like count

Revision ID: f1a2b3c4d5e6
Revises: b1c2d3e4f5a6
Create Date: 2026-03-30
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'f1a2b3c4d5e6'
down_revision = '2957358320e2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add like_count to reel_comments
    op.add_column('reel_comments', sa.Column('like_count', sa.Integer(), nullable=False, server_default='0'))

    # Update notifications check constraint to include new types
    op.execute("ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check")
    op.execute(
        "ALTER TABLE notifications ADD CONSTRAINT notifications_type_check "
        "CHECK (notif_type IN ('follow', 'like_post', 'comment_post', 'like_reel', 'comment_reel', 'mention', 'reply_post', 'reply_reel', 'like_comment'))"
    )

    # Create comment_likes table (post comments)
    op.create_table(
        'comment_likes',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('comment_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['comment_id'], ['comments.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('user_id', 'comment_id', name='uq_comment_like'),
    )
    op.create_index('idx_comment_likes_comment', 'comment_likes', ['comment_id'])
    op.create_index('idx_comment_likes_user', 'comment_likes', ['user_id'])

    # Create reel_comment_likes table
    op.create_table(
        'reel_comment_likes',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('comment_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['comment_id'], ['reel_comments.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('user_id', 'comment_id', name='uq_reel_comment_like'),
    )
    op.create_index('idx_reel_comment_likes_comment', 'reel_comment_likes', ['comment_id'])
    op.create_index('idx_reel_comment_likes_user', 'reel_comment_likes', ['user_id'])


def downgrade() -> None:
    op.drop_table('reel_comment_likes')
    op.drop_table('comment_likes')
    op.execute("ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check")
    op.execute(
        "ALTER TABLE notifications ADD CONSTRAINT notifications_type_check "
        "CHECK (notif_type IN ('follow', 'like_post', 'comment_post', 'like_reel', 'comment_reel', 'mention'))"
    )
    op.drop_column('reel_comments', 'like_count')

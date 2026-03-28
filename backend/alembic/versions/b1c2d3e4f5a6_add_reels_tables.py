"""add reels tables

Revision ID: b1c2d3e4f5a6
Revises: a1b2c3d4e5f6
Create Date: 2026-03-28
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'b1c2d3e4f5a6'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop if exists from a failed previous attempt, then recreate cleanly
    op.execute("DROP TYPE IF EXISTS reel_status")
    op.execute("CREATE TYPE reel_status AS ENUM ('pending', 'processing', 'ready', 'failed')")

    # ── reels ──────────────────────────────────────────────────────────────────
    op.create_table(
        'reels',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('title', sa.String(100), nullable=False, server_default=''),
        sa.Column('description', sa.Text(), nullable=False, server_default=''),
        sa.Column('train_number', sa.String(10), nullable=True),
        sa.Column('train_name', sa.String(100), nullable=True),
        sa.Column('station_tag', sa.String(100), nullable=True),
        sa.Column('raw_s3_key', sa.String(512), nullable=True),
        sa.Column('hls_key', sa.String(512), nullable=True),
        sa.Column('thumbnail_key', sa.String(512), nullable=True),
        sa.Column('duration_secs', sa.Integer(), nullable=True),
        sa.Column('width', sa.Integer(), nullable=True),
        sa.Column('height', sa.Integer(), nullable=True),
        sa.Column('file_size_bytes', sa.Integer(), nullable=True),
        sa.Column('status', sa.Enum('pending', 'processing', 'ready', 'failed', name='reel_status'), nullable=False, server_default='pending'),
        sa.Column('views', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('likes_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('comments_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('saves_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_public', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_reels_user_created', 'reels', ['user_id', sa.text('created_at DESC')])
    op.create_index('idx_reels_status_created', 'reels', ['status', sa.text('created_at DESC')])

    # ── reel_likes ─────────────────────────────────────────────────────────────
    op.create_table(
        'reel_likes',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('reel_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['reel_id'], ['reels.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('reel_id', 'user_id', name='uq_reel_like'),
    )
    op.create_index('idx_reel_likes_reel', 'reel_likes', ['reel_id'])
    op.create_index('idx_reel_likes_user', 'reel_likes', ['user_id'])

    # ── reel_comments ──────────────────────────────────────────────────────────
    op.create_table(
        'reel_comments',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('reel_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('parent_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['reel_id'], ['reels.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['parent_id'], ['reel_comments.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_reel_comments_reel_parent', 'reel_comments', ['reel_id', 'parent_id'])

    # ── reel_saves ─────────────────────────────────────────────────────────────
    op.create_table(
        'reel_saves',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('reel_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['reel_id'], ['reels.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('reel_id', 'user_id', name='uq_reel_save'),
    )
    op.create_index('idx_reel_saves_user', 'reel_saves', ['user_id'])

    # ── reel_views ─────────────────────────────────────────────────────────────
    op.create_table(
        'reel_views',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('reel_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('watched_secs', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['reel_id'], ['reels.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_reel_views_reel', 'reel_views', ['reel_id'])


def downgrade() -> None:
    op.drop_table('reel_views')
    op.drop_table('reel_saves')
    op.drop_table('reel_comments')
    op.drop_table('reel_likes')
    op.drop_table('reels')
    op.execute("DROP TYPE IF EXISTS reel_status")

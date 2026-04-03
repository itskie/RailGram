"""add is_admin to users and content_reports table

Revision ID: f2a3b4c5d6e7
Revises: e7f8a9b0c1d2
Create Date: 2026-04-03

"""
import uuid
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = 'f2a3b4c5d6e7'
down_revision = 'e7f8a9b0c1d2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add is_admin to users
    op.add_column('users', sa.Column('is_admin', sa.Boolean(), nullable=False, server_default='false'))

    # Create content_reports table
    op.create_table(
        'content_reports',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('reporter_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('post_id', UUID(as_uuid=True), sa.ForeignKey('posts.id', ondelete='CASCADE'), nullable=True),
        sa.Column('reel_id', UUID(as_uuid=True), sa.ForeignKey('reels.id', ondelete='CASCADE'), nullable=True),
        sa.Column('reason', sa.String(50), nullable=False),
        sa.Column('details', sa.Text(), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('admin_note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_report_status', 'content_reports', ['status'])
    op.create_index('ix_report_reporter', 'content_reports', ['reporter_id'])


def downgrade() -> None:
    op.drop_index('ix_report_reporter', table_name='content_reports')
    op.drop_index('ix_report_status', table_name='content_reports')
    op.drop_table('content_reports')
    op.drop_column('users', 'is_admin')

"""Stories: video support, reactions, highlights

Revision ID: c1d2e3f4a5b6
Revises: 2957358320e2
Create Date: 2026-04-06 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "c1d2e3f4a5b6"
down_revision: Union[str, None] = "2957358320e2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new columns to stories
    op.add_column("stories", sa.Column("media_type", sa.String(10), nullable=False, server_default="photo"))
    op.add_column("stories", sa.Column("duration_secs", sa.Integer(), nullable=True))
    op.add_column("stories", sa.Column("thumbnail_key", sa.String(500), nullable=True))
    op.add_column("stories", sa.Column("reaction_count", sa.Integer(), nullable=False, server_default="0"))

    # Story reactions table
    op.create_table(
        "story_reactions",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("story_id", UUID(as_uuid=True), sa.ForeignKey("stories.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("emoji", sa.String(10), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("story_id", "user_id", name="uq_story_reaction"),
    )

    # Story highlights table
    op.create_table(
        "story_highlights",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("title", sa.String(60), nullable=False),
        sa.Column("cover_key", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # Story highlight items table
    op.create_table(
        "story_highlight_items",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("highlight_id", UUID(as_uuid=True), sa.ForeignKey("story_highlights.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("story_id", UUID(as_uuid=True), sa.ForeignKey("stories.id", ondelete="SET NULL"), nullable=True),
        sa.Column("media_key", sa.String(500), nullable=False),
        sa.Column("media_type", sa.String(10), nullable=False, server_default="photo"),
        sa.Column("thumbnail_key", sa.String(500), nullable=True),
        sa.Column("caption", sa.String(300), nullable=True),
        sa.Column("added_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("highlight_id", "story_id", name="uq_highlight_story"),
    )


def downgrade() -> None:
    op.drop_table("story_highlight_items")
    op.drop_table("story_highlights")
    op.drop_table("story_reactions")
    op.drop_column("stories", "reaction_count")
    op.drop_column("stories", "thumbnail_key")
    op.drop_column("stories", "duration_secs")
    op.drop_column("stories", "media_type")

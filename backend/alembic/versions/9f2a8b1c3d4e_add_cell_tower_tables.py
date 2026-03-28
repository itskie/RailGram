"""add_cell_tower_tables

Revision ID: 9f2a8b1c3d4e
Revises: c5e4645d33bf
Create Date: 2026-03-28 10:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '9f2a8b1c3d4e'
down_revision: Union[str, None] = 'c5e4645d33bf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create cell_tower_reports table
    op.create_table(
        'cell_tower_reports',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('train_no', sa.String(length=10), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('mcc', sa.Integer(), nullable=False),
        sa.Column('mnc', sa.Integer(), nullable=False),
        sa.Column('lac', sa.Integer(), nullable=False),
        sa.Column('cid', sa.Integer(), nullable=False),
        sa.Column('rssi_dbm', sa.Integer(), nullable=False),
        sa.Column('tower_count', sa.Integer(), server_default='1', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_cell_tower_train_time', 'cell_tower_reports', ['train_no', 'created_at'], unique=False)
    op.create_index('ix_cell_tower_id', 'cell_tower_reports', ['mcc', 'mnc', 'lac', 'cid'], unique=False)
    op.create_index(op.f('ix_cell_tower_reports_train_no'), 'cell_tower_reports', ['train_no'], unique=False)

    # Create cell_tower_calibration table
    op.create_table(
        'cell_tower_calibration',
        sa.Column('mcc', sa.Integer(), nullable=False),
        sa.Column('mnc', sa.Integer(), nullable=False),
        sa.Column('lac', sa.Integer(), nullable=False),
        sa.Column('cid', sa.Integer(), nullable=False),
        sa.Column('latitude', sa.Float(), nullable=True),
        sa.Column('longitude', sa.Float(), nullable=True),
        sa.Column('accuracy_m', sa.Integer(), nullable=True),
        sa.Column('tower_name', sa.String(length=100), nullable=True),
        sa.Column('operator', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('confidence_score', sa.Float(), server_default='0.5', nullable=False),
        sa.Column('samples_count', sa.Integer(), server_default='0', nullable=False),
        sa.PrimaryKeyConstraint('mcc', 'mnc', 'lac', 'cid')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('cell_tower_calibration')
    op.drop_index('ix_cell_tower_reports_train_no', table_name='cell_tower_reports')
    op.drop_index('ix_cell_tower_id', table_name='cell_tower_reports')
    op.drop_index('ix_cell_tower_train_time', table_name='cell_tower_reports')
    op.drop_table('cell_tower_reports')

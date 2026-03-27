"""
Phase 4 – WIMT Tracking Engine Models

GpsReport     : Raw GPS coordinates submitted by a user riding a train.
SpotterReport : User witnessed a train at a station (arrived / departed / passed).
TrainPosition : Computed best-estimate current position, upserted by the truth engine.
"""
import uuid
from typing import Optional
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from api.database import Base


class GpsReport(Base):
    __tablename__ = "gps_reports"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    train_no: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    accuracy_m: Mapped[Optional[float]] = mapped_column(Float)
    speed_kmh: Mapped[Optional[float]] = mapped_column(Float)
    altitude_m: Mapped[Optional[float]] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        Index("ix_gps_train_time", "train_no", "created_at"),
    )


class SpotterReport(Base):
    __tablename__ = "spotter_reports"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    train_no: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    station_code: Mapped[str] = mapped_column(
        String(10),
        ForeignKey("station_master.station_code", ondelete="CASCADE"),
        nullable=False,
    )
    # "arrived" | "departed" | "passed" | "delayed"
    event_type: Mapped[str] = mapped_column(String(20), nullable=False)
    # Positive = late, negative = early, None = unknown
    delay_minutes: Mapped[Optional[int]] = mapped_column(Integer)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        Index("ix_spotter_train_time", "train_no", "created_at"),
    )


class TrainPosition(Base):
    """
    One row per active train. Upserted by the truth engine every 60 s.
    Also writable directly via the /live endpoint miss path.
    """
    __tablename__ = "train_positions"

    train_no: Mapped[str] = mapped_column(String(10), primary_key=True)
    # "gps" | "spotter" | "schedule"
    source: Mapped[str] = mapped_column(String(20), nullable=False)
    latitude: Mapped[Optional[float]] = mapped_column(Float)
    longitude: Mapped[Optional[float]] = mapped_column(Float)
    speed_kmh: Mapped[Optional[float]] = mapped_column(Float)
    from_station_code: Mapped[Optional[str]] = mapped_column(String(10))
    to_station_code: Mapped[Optional[str]] = mapped_column(String(10))
    next_station_code: Mapped[Optional[str]] = mapped_column(String(10))
    next_station_eta: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    delay_minutes: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    confidence: Mapped[float] = mapped_column(Float, default=0.5)
    last_known_station_code: Mapped[Optional[str]] = mapped_column(String(10))
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

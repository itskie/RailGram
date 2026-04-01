"""
Train Data Models - Phase 2

TrainMaster: Master list of all IR trains (~14k)
StationMaster: All IR stations (~7k) with lat/lng
TripSchedule: Per-station timetable row for each train
"""
import uuid
from typing import Optional
from datetime import datetime

from sqlalchemy import (
    Boolean, Float, ForeignKey, Index, Integer, String, Text,
    UniqueConstraint, func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from api.database import Base


class TrainMaster(Base):
    __tablename__ = "train_master"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    train_no: Mapped[str] = mapped_column(String(10), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    train_type: Mapped[Optional[str]] = mapped_column(String(50))   # Rajdhani / Express / Passenger / etc.
    zone: Mapped[Optional[str]] = mapped_column(String(20))         # ER, NR, SCR, WR, etc.
    runs_on: Mapped[Optional[str]] = mapped_column(String(50))      # "1234567" = days of week bitmask
    total_distance_km: Mapped[Optional[int]] = mapped_column(Integer)
    origin_code: Mapped[Optional[str]] = mapped_column(String(10))
    destination_code: Mapped[Optional[str]] = mapped_column(String(10))
    duration_minutes: Mapped[Optional[int]] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    schedule: Mapped[list["TripSchedule"]] = relationship(
        "TripSchedule", back_populates="train", lazy="selectin",
        order_by="TripSchedule.sequence"
    )

    __table_args__ = (
        Index("ix_train_master_name", "name"),
    )


class StationMaster(Base):
    __tablename__ = "station_master"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    station_code: Mapped[str] = mapped_column(String(10), unique=True, nullable=False, index=True)
    station_name: Mapped[str] = mapped_column(String(200), nullable=False)
    city: Mapped[Optional[str]] = mapped_column(String(100))
    state: Mapped[Optional[str]] = mapped_column(String(100))
    zone: Mapped[Optional[str]] = mapped_column(String(20))
    latitude: Mapped[Optional[float]] = mapped_column(Float)
    longitude: Mapped[Optional[float]] = mapped_column(Float)
    elevation_m: Mapped[Optional[int]] = mapped_column(Integer)
    is_major: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    stop_entries: Mapped[list["TripSchedule"]] = relationship(
        "TripSchedule", back_populates="station", lazy="noload"
    )


class TripSchedule(Base):
    __tablename__ = "trip_schedule"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    train_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("train_master.id", ondelete="CASCADE"),
        nullable=False,
    )
    station_code: Mapped[str] = mapped_column(
        String(10),
        ForeignKey("station_master.station_code", ondelete="CASCADE"),
        nullable=False,
    )
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    arrival_time: Mapped[Optional[str]] = mapped_column(String(8))    # "HH:MM" or None for origin
    departure_time: Mapped[Optional[str]] = mapped_column(String(8))  # "HH:MM" or None for terminal
    halt_minutes: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    distance_km: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    # Day offset from origin departure (0 = same day, 1 = next day, etc.)
    day: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    platform: Mapped[Optional[str]] = mapped_column(String(10))

    train: Mapped["TrainMaster"] = relationship("TrainMaster", back_populates="schedule")
    station: Mapped["StationMaster"] = relationship("StationMaster", back_populates="stop_entries")

    __table_args__ = (
        UniqueConstraint("train_id", "sequence", name="uq_trip_schedule_train_seq"),
        Index("ix_trip_schedule_train_id", "train_id"),
        Index("ix_trip_schedule_station_code", "station_code"),
    )

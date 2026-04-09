"""
Phase 4 – WIMT Tracking Engine Models

GpsReport           : Raw GPS coordinates submitted by a user riding a train.
CellTowerReport     : Cell tower signals (MCC/MNC/LAC/CID + RSSI) from user device.
CellTowerCalibration: Bootstrapped tower DB (lat/lng) + passive calibration from user data.
TrainPosition       : Computed best-estimate current position, upserted by the truth engine.
"""
import uuid
from typing import Optional
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func
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



class CellTowerReport(Base):
    """
    Cell tower signal report from a user's device.
    Phone reads Cell IDs (MCC/MNC/LAC/CID) + signal strength (RSSI dBm).
    Used for triangulation to compute train position in tunnels/dead zones.
    """
    __tablename__ = "cell_tower_reports"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    train_no: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    # Cell IDs per 3GPP spec
    mcc: Mapped[int] = mapped_column(Integer, nullable=False)  # Mobile Country Code (e.g., 404 = India)
    mnc: Mapped[int] = mapped_column(Integer, nullable=False)  # Mobile Network Code (e.g., 10 = Airtel)
    lac: Mapped[int] = mapped_column(Integer, nullable=False)  # Location Area Code
    cid: Mapped[int] = mapped_column(Integer, nullable=False)  # Cell ID
    rssi_dbm: Mapped[int] = mapped_column(Integer, nullable=False)  # Signal strength (-140 to -44 dBm)
    # Number of towers reported in same submission (for quality scoring)
    tower_count: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        Index("ix_cell_tower_train_time", "train_no", "created_at"),
        Index("ix_cell_tower_id", "mcc", "mnc", "lac", "cid"),
    )


class CellTowerCalibration(Base):
    """
    Real-world cell tower database (lat/lng + location).
    Bootstrap from OpenCelliD India dataset.
    Passively updated via triangulation scores from user reports.
    """
    __tablename__ = "cell_tower_calibration"

    # Composite primary key: (mcc, mnc, lac, cid)
    mcc: Mapped[int] = mapped_column(Integer, primary_key=True)
    mnc: Mapped[int] = mapped_column(Integer, primary_key=True)
    lac: Mapped[int] = mapped_column(Integer, primary_key=True)
    cid: Mapped[int] = mapped_column(Integer, primary_key=True)

    # Tower location (±50-100m urban, ±1km rural estimated)
    latitude: Mapped[Optional[float]] = mapped_column(Float)
    longitude: Mapped[Optional[float]] = mapped_column(Float)
    accuracy_m: Mapped[Optional[int]] = mapped_column(Integer)  # Estimated accuracy radius

    # Calibration metadata
    tower_name: Mapped[Optional[str]] = mapped_column(String(100))  # City/area name
    operator: Mapped[Optional[str]] = mapped_column(String(50))    # Telecom operator name
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Confidence metrics for triangulation
    confidence_score: Mapped[float] = mapped_column(Float, default=0.5)  # 0.0 - 1.0
    samples_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")  # # of calibrations


class TrainPosition(Base):
    """
    One row per active train. Upserted by the truth engine every 60 s.
    Also writable directly via the /live endpoint miss path.
    """
    __tablename__ = "train_positions"

    train_no: Mapped[str] = mapped_column(String(10), primary_key=True)
    # "gps" | "cell_tower" | "ntes" | "schedule"
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

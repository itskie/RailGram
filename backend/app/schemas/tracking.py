from datetime import datetime
from typing import Optional
import uuid

from pydantic import BaseModel, Field, field_validator


class GpsReportCreate(BaseModel):
    latitude: float = Field(ge=-90.0, le=90.0)
    longitude: float = Field(ge=-180.0, le=180.0)
    accuracy_m: Optional[float] = Field(None, ge=0.0, le=10000.0)
    speed_kmh: Optional[float] = Field(None, ge=0.0, le=600.0)
    altitude_m: Optional[float] = None


class GpsReportOut(BaseModel):
    id: uuid.UUID
    train_no: str
    latitude: float
    longitude: float
    accuracy_m: Optional[float] = None
    speed_kmh: Optional[float] = None
    altitude_m: Optional[float] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SpotterReportCreate(BaseModel):
    station_code: str = Field(min_length=1, max_length=10)
    event_type: str = Field(min_length=1, max_length=20)
    delay_minutes: Optional[int] = Field(None, ge=-120, le=1440)
    notes: Optional[str] = Field(None, max_length=500)

    @field_validator("station_code")
    @classmethod
    def uppercase_code(cls, v: str) -> str:
        return v.strip().upper()

    @field_validator("event_type")
    @classmethod
    def valid_event(cls, v: str) -> str:
        allowed = {"arrived", "departed", "passed", "delayed"}
        if v not in allowed:
            raise ValueError(f"event_type must be one of {sorted(allowed)}")
        return v


class SpotterReportOut(BaseModel):
    id: uuid.UUID
    train_no: str
    station_code: str
    event_type: str
    delay_minutes: Optional[int] = None
    notes: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TrainPositionOut(BaseModel):
    """Live position response — all coordinate / station fields may be None
    when the schedule lacks GPS data for those stations.
    
    Tunnel detection fields added for GPS-failure scenarios (tunnels/underpass).
    """
    train_no: str
    source: str                         # "gps" | "cell_tower" | "spotter" | "schedule"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    speed_kmh: Optional[float] = None
    from_station_code: Optional[str] = None
    to_station_code: Optional[str] = None
    next_station_code: Optional[str] = None
    next_station_eta: Optional[str] = None   # ISO 8601 datetime string
    delay_minutes: int = 0
    confidence: float = 0.0              # 0.0 – 1.0
    last_known_station_code: Optional[str] = None
    computed_at: str                     # ISO 8601 datetime string
    
    # Tunnel detection (optional fields only if tunnel detected)
    tunnel_detected: Optional[bool] = None
    tunnel_confidence: Optional[float] = None  # 0.0 – 1.0 confidence in tunnel detection
    tunnel_start: Optional[str] = None  # ISO 8601 datetime when tunnel likely started
    estimated_tunnel_length_km: Optional[float] = None  # Estimated tunnel length in km


class CellTowerSignalInput(BaseModel):
    """Single cell tower observation from device (3+ required for triangulation)."""
    mcc: int = Field(ge=1, le=999)
    mnc: int = Field(ge=1, le=999)
    lac: int = Field(ge=0, le=65535)
    cid: int = Field(ge=0, le=4294967295)
    rssi_dbm: int = Field(ge=-150, le=-30)  # Signal strength in dBm
    radio: Optional[str] = None  # GSM | UMTS | LTE | NR (5G) — from Android TelephonyManager


class CellTowerReportCreate(BaseModel):
    """Submit cell tower signals from device for triangulation."""
    signals: list[CellTowerSignalInput] = Field(min_length=1, max_length=10)
    # Optional GPS anchor — used for 5G NR crowdsourcing & fallback
    gps_lat: Optional[float] = Field(default=None, ge=-90.0, le=90.0)
    gps_lng: Optional[float] = Field(default=None, ge=-180.0, le=180.0)
    gps_accuracy_m: Optional[int] = Field(default=None, ge=1, le=5000)

    @field_validator("signals")
    @classmethod
    def min_towers_for_use(cls, v: list) -> list:
        """Warn if fewer than 3 towers (triangulation needs 3+)."""
        if len(v) < 3:
            import warnings
            warnings.warn("Fewer than 3 cell towers provided; triangulation may be inaccurate")
        return v


class CellTowerReportOut(BaseModel):
    """Cell tower report confirmation."""
    id: uuid.UUID
    train_no: str
    mcc: int
    mnc: int
    lac: int
    cid: int
    rssi_dbm: int
    tower_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class TriangulationResultOut(BaseModel):
    """Triangulation result from cell tower signals."""
    latitude: float = Field(ge=-90.0, le=90.0)
    longitude: float = Field(ge=-180.0, le=180.0)
    accuracy_m: int = Field(ge=50, le=50000)
    confidence: float = Field(ge=0.0, le=1.0)


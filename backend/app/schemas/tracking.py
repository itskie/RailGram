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
    when the schedule lacks GPS data for those stations."""
    train_no: str
    source: str                         # "gps" | "spotter" | "schedule"
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

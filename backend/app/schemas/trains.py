"""Pydantic schemas for train data endpoints."""
import uuid
from typing import Optional
from pydantic import BaseModel, field_validator


class StationBrief(BaseModel):
    """Minimal station info used in train schedules."""
    station_code: str
    station_name: str
    city: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    model_config = {"from_attributes": True}


class StationDetail(StationBrief):
    """Full station record."""
    id: uuid.UUID
    state: Optional[str] = None
    zone: Optional[str] = None
    elevation_m: Optional[int] = None
    is_major: bool = False

    model_config = {"from_attributes": True}


class StationGeoJSON(BaseModel):
    """GeoJSON Feature for a station (for map rendering)."""
    type: str = "Feature"
    geometry: dict
    properties: dict

    @classmethod
    def from_station(cls, s: "StationDetail") -> "StationGeoJSON":
        return cls(
            geometry={
                "type": "Point",
                "coordinates": [s.longitude, s.latitude],
            } if s.latitude and s.longitude else {"type": "Point", "coordinates": []},
            properties={
                "code": s.station_code,
                "name": s.station_name,
                "city": s.city,
                "is_major": s.is_major,
            },
        )


class TrainBetweenResult(BaseModel):
    """Train between two stations — includes per-leg departure/arrival."""
    train_no: str
    name: str
    train_type: Optional[str] = None
    runs_on: Optional[str] = None
    departure_time: Optional[str] = None   # at from_code
    arrival_time: Optional[str] = None     # at to_code
    duration_minutes: Optional[int] = None
    from_day: int = 1
    to_day: int = 1


class ScheduleStop(BaseModel):
    """One stop in a train's timetable."""
    sequence: int
    station_code: str
    station_name: str
    city: Optional[str] = None
    arrival_time: Optional[str] = None    # "HH:MM" (None for origin)
    departure_time: Optional[str] = None  # "HH:MM" (None for terminal)
    halt_minutes: int = 0
    distance_km: int = 0
    day: int = 1
    platform: Optional[str] = None

    model_config = {"from_attributes": True}


class TrainBrief(BaseModel):
    """Compact train record for search results."""
    train_no: str
    name: str
    train_type: Optional[str] = None
    zone: Optional[str] = None
    origin_code: Optional[str] = None
    destination_code: Optional[str] = None
    total_distance_km: Optional[int] = None
    duration_minutes: Optional[int] = None
    runs_on: Optional[str] = None
    is_running_today: Optional[bool] = None

    model_config = {"from_attributes": True}


class TrainSchedule(TrainBrief):
    """Full train record including timetable."""
    id: uuid.UUID
    runs_on: Optional[str] = None
    stops: list[ScheduleStop] = []

    model_config = {"from_attributes": True}


class TrainSearchResponse(BaseModel):
    trains: list[TrainBrief]
    total: int
    page: int
    limit: int


class StationSearchResponse(BaseModel):
    stations: list[StationDetail]
    total: int


class StationBoardEntry(BaseModel):
    """One train entry on the live station departure/arrival board."""
    train_no: str
    train_name: str
    train_type: Optional[str] = None
    origin_code: Optional[str] = None
    destination_code: Optional[str] = None
    arrival_time: Optional[str] = None
    departure_time: Optional[str] = None
    platform: Optional[str] = None
    status: str = "On Time"   # "On Time" | "Delayed"
    delay_minutes: int = 0


class StationBoardResponse(BaseModel):
    station_code: str
    station_name: str
    entries: list[StationBoardEntry]
    as_of: str  # ISO timestamp

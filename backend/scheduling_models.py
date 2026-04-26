"""
Models para o sistema de agendamento.
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime, timezone
import uuid


# ===== PROFESSIONAL MODELS =====

class Professional(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    barbershop_id: str
    name: str
    phone: str
    email: Optional[str] = None
    specialties: List[str] = Field(default_factory=lambda: ["haircut", "beard"])
    active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ProfessionalCreate(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    specialties: List[str] = Field(default_factory=lambda: ["haircut", "beard"])


class ProfessionalUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    specialties: Optional[List[str]] = None
    active: Optional[bool] = None


class ProfessionalResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    phone: str
    email: Optional[str]
    specialties: List[str]
    active: bool
    created_at: datetime


# ===== WORKING HOURS MODELS =====

class DaySchedule(BaseModel):
    open: str  # "08:00"
    close: str  # "18:00"
    enabled: bool = True


class WorkingHours(BaseModel):
    model_config = ConfigDict(extra="ignore")
    barbershop_id: str
    monday: Optional[DaySchedule] = Field(default_factory=lambda: DaySchedule(open="08:00", close="18:00"))
    tuesday: Optional[DaySchedule] = Field(default_factory=lambda: DaySchedule(open="08:00", close="18:00"))
    wednesday: Optional[DaySchedule] = Field(default_factory=lambda: DaySchedule(open="08:00", close="18:00"))
    thursday: Optional[DaySchedule] = Field(default_factory=lambda: DaySchedule(open="08:00", close="18:00"))
    friday: Optional[DaySchedule] = Field(default_factory=lambda: DaySchedule(open="08:00", close="18:00"))
    saturday: Optional[DaySchedule] = Field(default_factory=lambda: DaySchedule(open="08:00", close="14:00"))
    sunday: Optional[DaySchedule] = None


class WorkingHoursUpdate(BaseModel):
    monday: Optional[DaySchedule] = None
    tuesday: Optional[DaySchedule] = None
    wednesday: Optional[DaySchedule] = None
    thursday: Optional[DaySchedule] = None
    friday: Optional[DaySchedule] = None
    saturday: Optional[DaySchedule] = None
    sunday: Optional[DaySchedule] = None


# ===== APPOINTMENT MODELS =====

class Appointment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    barbershop_id: str
    professional_id: str
    professional_name: str = ""
    client_id: Optional[str] = None
    client_name: str
    client_phone: str
    service_id: str
    service_name: str = ""
    duration_minutes: int = 30
    price: float = 0.0
    date: str  # "2026-02-15"
    start_time: str  # "09:00"
    end_time: str  # "09:30"
    status: str = "scheduled"  # scheduled, completed, cancelled, no_show
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AppointmentCreate(BaseModel):
    professional_id: str
    client_name: str
    client_phone: str
    client_id: Optional[str] = None
    service_id: str
    date: str  # "2026-02-15"
    start_time: str  # "09:00"
    notes: Optional[str] = None


class PublicAppointmentCreate(BaseModel):
    """For self-service booking (no auth)."""
    professional_id: str
    client_name: str
    client_phone: str
    service_id: str
    date: str
    start_time: str
    notes: Optional[str] = None


class AppointmentStatusUpdate(BaseModel):
    status: str  # scheduled, completed, cancelled, no_show


class AppointmentResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    barbershop_id: str
    professional_id: str
    professional_name: str
    client_id: Optional[str]
    client_name: str
    client_phone: str
    service_id: str
    service_name: str
    duration_minutes: int
    price: float
    date: str
    start_time: str
    end_time: str
    status: str
    notes: Optional[str]
    created_at: datetime

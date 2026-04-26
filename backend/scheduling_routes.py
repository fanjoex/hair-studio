"""
Rotas para o sistema de agendamento.
"""

from fastapi import APIRouter, HTTPException, Request, Depends
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import logging

from scheduling_models import (
    Professional, ProfessionalCreate, ProfessionalUpdate, ProfessionalResponse,
    WorkingHours, WorkingHoursUpdate, DaySchedule,
    Appointment, AppointmentCreate, PublicAppointmentCreate,
    AppointmentStatusUpdate, AppointmentResponse,
)

scheduling_router = APIRouter(prefix="/api")

db = None

def set_scheduling_db(database):
    global db
    db = database


# ===== HELPERS =====

async def get_current_user_from_request(request: Request) -> dict:
    from server import get_current_user
    return await get_current_user(request)


async def require_barbershop_access(request: Request) -> tuple:
    user = await get_current_user_from_request(request)
    if user.get("role") == "master_admin":
        return user, None
    if user.get("role") in ["barbershop_owner", "barbershop_staff"]:
        barbershop_id = user.get("barbershop_id")
        if not barbershop_id:
            raise HTTPException(status_code=403, detail="User not associated with any barbershop")
        return user, barbershop_id
    raise HTTPException(status_code=403, detail="Barbershop access required")


def calculate_end_time(start_time: str, duration_minutes: int) -> str:
    h, m = map(int, start_time.split(":"))
    total = h * 60 + m + duration_minutes
    return f"{total // 60:02d}:{total % 60:02d}"


DAY_MAP = {0: "monday", 1: "tuesday", 2: "wednesday", 3: "thursday", 4: "friday", 5: "saturday", 6: "sunday"}


# ===== PROFESSIONAL ROUTES =====

@scheduling_router.get("/barbershop/professionals", response_model=List[ProfessionalResponse])
async def list_professionals(request: Request):
    try:
        user, barbershop_id = await require_barbershop_access(request)
        if not barbershop_id:
            raise HTTPException(status_code=400, detail="Barbershop ID required")
        pros = await db.professionals.find({"barbershop_id": barbershop_id}, {"_id": 0}).sort("name", 1).to_list(100)
        result = []
        for p in pros:
            if isinstance(p.get("created_at"), str):
                p["created_at"] = datetime.fromisoformat(p["created_at"])
            result.append(ProfessionalResponse(**p))
        return result
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error listing professionals: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@scheduling_router.post("/barbershop/professionals", response_model=ProfessionalResponse)
async def create_professional(data: ProfessionalCreate, request: Request):
    try:
        user, barbershop_id = await require_barbershop_access(request)
        if not barbershop_id:
            raise HTTPException(status_code=400, detail="Barbershop ID required")
        pro = Professional(barbershop_id=barbershop_id, **data.model_dump())
        doc = pro.model_dump()
        doc["created_at"] = doc["created_at"].isoformat()
        doc["updated_at"] = doc["updated_at"].isoformat()
        await db.professionals.insert_one(doc)
        return ProfessionalResponse(**pro.model_dump())
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error creating professional: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@scheduling_router.put("/barbershop/professionals/{pro_id}", response_model=ProfessionalResponse)
async def update_professional(pro_id: str, data: ProfessionalUpdate, request: Request):
    try:
        user, barbershop_id = await require_barbershop_access(request)
        query = {"id": pro_id}
        if barbershop_id:
            query["barbershop_id"] = barbershop_id
        pro = await db.professionals.find_one(query)
        if not pro:
            raise HTTPException(status_code=404, detail="Professional not found")
        update_dict = data.model_dump(exclude_unset=True)
        if update_dict:
            update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
            await db.professionals.update_one({"id": pro_id}, {"$set": update_dict})
        updated = await db.professionals.find_one({"id": pro_id}, {"_id": 0})
        if isinstance(updated.get("created_at"), str):
            updated["created_at"] = datetime.fromisoformat(updated["created_at"])
        return ProfessionalResponse(**updated)
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating professional: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@scheduling_router.delete("/barbershop/professionals/{pro_id}")
async def delete_professional(pro_id: str, request: Request):
    try:
        user, barbershop_id = await require_barbershop_access(request)
        query = {"id": pro_id}
        if barbershop_id:
            query["barbershop_id"] = barbershop_id
        result = await db.professionals.delete_one(query)
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Professional not found")
        return {"message": "Professional deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting professional: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== WORKING HOURS ROUTES =====

@scheduling_router.get("/barbershop/working-hours")
async def get_working_hours(request: Request):
    try:
        user, barbershop_id = await require_barbershop_access(request)
        if not barbershop_id:
            raise HTTPException(status_code=400, detail="Barbershop ID required")
        wh = await db.working_hours.find_one({"barbershop_id": barbershop_id}, {"_id": 0})
        if not wh:
            default = WorkingHours(barbershop_id=barbershop_id)
            doc = default.model_dump()
            await db.working_hours.insert_one(doc)
            wh = default.model_dump()
        return wh
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting working hours: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@scheduling_router.put("/barbershop/working-hours")
async def update_working_hours(data: WorkingHoursUpdate, request: Request):
    try:
        user, barbershop_id = await require_barbershop_access(request)
        if not barbershop_id:
            raise HTTPException(status_code=400, detail="Barbershop ID required")
        update_dict = data.model_dump(exclude_unset=True)
        # Convert DaySchedule objects to dicts
        for key, val in update_dict.items():
            if isinstance(val, DaySchedule):
                update_dict[key] = val.model_dump()
        existing = await db.working_hours.find_one({"barbershop_id": barbershop_id})
        if not existing:
            default = WorkingHours(barbershop_id=barbershop_id)
            doc = default.model_dump()
            doc.update(update_dict)
            await db.working_hours.insert_one(doc)
        else:
            await db.working_hours.update_one({"barbershop_id": barbershop_id}, {"$set": update_dict})
        wh = await db.working_hours.find_one({"barbershop_id": barbershop_id}, {"_id": 0})
        return wh
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating working hours: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== APPOINTMENT ROUTES =====

@scheduling_router.get("/barbershop/appointments", response_model=List[AppointmentResponse])
async def list_appointments(request: Request, date: Optional[str] = None):
    try:
        user, barbershop_id = await require_barbershop_access(request)
        if not barbershop_id:
            raise HTTPException(status_code=400, detail="Barbershop ID required")
        query = {"barbershop_id": barbershop_id}
        if date:
            query["date"] = date
        appointments = await db.appointments.find(query, {"_id": 0}).sort([("date", 1), ("start_time", 1)]).to_list(500)
        result = []
        for a in appointments:
            if isinstance(a.get("created_at"), str):
                a["created_at"] = datetime.fromisoformat(a["created_at"])
            result.append(AppointmentResponse(**a))
        return result
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error listing appointments: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@scheduling_router.post("/barbershop/appointments", response_model=AppointmentResponse)
async def create_appointment(data: AppointmentCreate, request: Request):
    try:
        user, barbershop_id = await require_barbershop_access(request)
        if not barbershop_id:
            raise HTTPException(status_code=400, detail="Barbershop ID required")
        return await _create_appointment(barbershop_id, data)
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error creating appointment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@scheduling_router.put("/barbershop/appointments/{apt_id}/status", response_model=AppointmentResponse)
async def update_appointment_status(apt_id: str, data: AppointmentStatusUpdate, request: Request):
    try:
        user, barbershop_id = await require_barbershop_access(request)
        query = {"id": apt_id}
        if barbershop_id:
            query["barbershop_id"] = barbershop_id
        apt = await db.appointments.find_one(query)
        if not apt:
            raise HTTPException(status_code=404, detail="Appointment not found")
        if data.status not in ["scheduled", "completed", "cancelled", "no_show"]:
            raise HTTPException(status_code=400, detail="Invalid status")
        await db.appointments.update_one(
            {"id": apt_id},
            {"$set": {"status": data.status, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        updated = await db.appointments.find_one({"id": apt_id}, {"_id": 0})
        if isinstance(updated.get("created_at"), str):
            updated["created_at"] = datetime.fromisoformat(updated["created_at"])
        return AppointmentResponse(**updated)
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating appointment status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@scheduling_router.delete("/barbershop/appointments/{apt_id}")
async def delete_appointment(apt_id: str, request: Request):
    try:
        user, barbershop_id = await require_barbershop_access(request)
        query = {"id": apt_id}
        if barbershop_id:
            query["barbershop_id"] = barbershop_id
        result = await db.appointments.delete_one(query)
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Appointment not found")
        return {"message": "Appointment deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting appointment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== PUBLIC BOOKING ROUTES (No auth) =====

@scheduling_router.get("/public/barbershop/{barbershop_id}")
async def get_public_barbershop_info(barbershop_id: str):
    """Public info for booking page."""
    try:
        barbershop = await db.barbershops.find_one({"id": barbershop_id, "status": "active"}, {"_id": 0})
        if not barbershop:
            raise HTTPException(status_code=404, detail="Barbershop not found")
        services = await db.services.find(
            {"barbershop_id": barbershop_id, "active": True}, {"_id": 0}
        ).sort("name", 1).to_list(100)
        professionals = await db.professionals.find(
            {"barbershop_id": barbershop_id, "active": True}, {"_id": 0}
        ).sort("name", 1).to_list(100)
        wh = await db.working_hours.find_one({"barbershop_id": barbershop_id}, {"_id": 0})
        if not wh:
            wh = WorkingHours(barbershop_id=barbershop_id).model_dump()

        return {
            "name": barbershop.get("name"),
            "phone": barbershop.get("phone"),
            "address": barbershop.get("address"),
            "services": [{"id": s["id"], "name": s["name"], "duration_minutes": s["duration_minutes"], "price": s["price"], "category": s["category"]} for s in services],
            "professionals": [{"id": p["id"], "name": p["name"], "specialties": p.get("specialties", [])} for p in professionals],
            "working_hours": wh,
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting public barbershop info: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@scheduling_router.get("/public/barbershop/{barbershop_id}/available-slots")
async def get_available_slots(barbershop_id: str, date: str, professional_id: str, service_id: str):
    """Get available time slots for a given date, professional, and service."""
    try:
        barbershop = await db.barbershops.find_one({"id": barbershop_id, "status": "active"})
        if not barbershop:
            raise HTTPException(status_code=404, detail="Barbershop not found")

        service = await db.services.find_one({"id": service_id, "barbershop_id": barbershop_id, "active": True})
        if not service:
            raise HTTPException(status_code=404, detail="Service not found")

        duration = service["duration_minutes"]

        # Get working hours for the day
        target_date = datetime.strptime(date, "%Y-%m-%d")
        day_name = DAY_MAP[target_date.weekday()]
        wh = await db.working_hours.find_one({"barbershop_id": barbershop_id}, {"_id": 0})
        if not wh:
            wh = WorkingHours(barbershop_id=barbershop_id).model_dump()

        day_schedule = wh.get(day_name)
        if not day_schedule or not day_schedule.get("enabled", True):
            return {"slots": []}

        open_time = day_schedule["open"]
        close_time = day_schedule["close"]

        # Get existing appointments for this professional on this date
        existing = await db.appointments.find(
            {"barbershop_id": barbershop_id, "professional_id": professional_id, "date": date, "status": {"$ne": "cancelled"}},
            {"_id": 0}
        ).to_list(100)

        booked_ranges = []
        for a in existing:
            booked_ranges.append((a["start_time"], a["end_time"]))

        # Generate slots every 30 min
        slots = []
        oh, om = map(int, open_time.split(":"))
        ch, cm = map(int, close_time.split(":"))
        current = oh * 60 + om
        close_min = ch * 60 + cm

        while current + duration <= close_min:
            slot_start = f"{current // 60:02d}:{current % 60:02d}"
            slot_end = f"{(current + duration) // 60:02d}:{(current + duration) % 60:02d}"

            # Check conflict
            conflict = False
            for bs, be in booked_ranges:
                bsm = int(bs.split(":")[0]) * 60 + int(bs.split(":")[1])
                bem = int(be.split(":")[0]) * 60 + int(be.split(":")[1])
                if current < bem and (current + duration) > bsm:
                    conflict = True
                    break

            if not conflict:
                slots.append({"start": slot_start, "end": slot_end})

            current += 30

        return {"slots": slots}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting available slots: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@scheduling_router.post("/public/barbershop/{barbershop_id}/book", response_model=AppointmentResponse)
async def public_book_appointment(barbershop_id: str, data: PublicAppointmentCreate):
    """Public endpoint for client self-service booking."""
    try:
        barbershop = await db.barbershops.find_one({"id": barbershop_id, "status": "active"})
        if not barbershop:
            raise HTTPException(status_code=404, detail="Barbershop not found")
        appointment_data = AppointmentCreate(
            professional_id=data.professional_id,
            client_name=data.client_name,
            client_phone=data.client_phone,
            service_id=data.service_id,
            date=data.date,
            start_time=data.start_time,
            notes=data.notes,
        )
        return await _create_appointment(barbershop_id, appointment_data)
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error in public booking: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== SHARED HELPERS =====

async def _create_appointment(barbershop_id: str, data: AppointmentCreate) -> AppointmentResponse:
    """Shared logic for creating an appointment."""
    # Validate professional
    pro = await db.professionals.find_one({"id": data.professional_id, "barbershop_id": barbershop_id, "active": True})
    if not pro:
        raise HTTPException(status_code=404, detail="Professional not found or inactive")

    # Validate service
    service = await db.services.find_one({"id": data.service_id, "barbershop_id": barbershop_id, "active": True})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found or inactive")

    duration = service["duration_minutes"]
    end_time = calculate_end_time(data.start_time, duration)

    # Check conflict
    start_min = int(data.start_time.split(":")[0]) * 60 + int(data.start_time.split(":")[1])
    end_min = start_min + duration

    existing = await db.appointments.find(
        {"barbershop_id": barbershop_id, "professional_id": data.professional_id, "date": data.date, "status": {"$ne": "cancelled"}},
        {"_id": 0}
    ).to_list(100)

    for a in existing:
        a_start = int(a["start_time"].split(":")[0]) * 60 + int(a["start_time"].split(":")[1])
        a_end = int(a["end_time"].split(":")[0]) * 60 + int(a["end_time"].split(":")[1])
        if start_min < a_end and end_min > a_start:
            raise HTTPException(status_code=409, detail=f"Horário em conflito com agendamento existente ({a['start_time']} - {a['end_time']})")

    appointment = Appointment(
        barbershop_id=barbershop_id,
        professional_id=data.professional_id,
        professional_name=pro["name"],
        client_id=data.client_id,
        client_name=data.client_name,
        client_phone=data.client_phone,
        service_id=data.service_id,
        service_name=service["name"],
        duration_minutes=duration,
        price=service["price"],
        date=data.date,
        start_time=data.start_time,
        end_time=end_time,
        notes=data.notes,
    )

    doc = appointment.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    doc["updated_at"] = doc["updated_at"].isoformat()
    await db.appointments.insert_one(doc)

    return AppointmentResponse(**appointment.model_dump())

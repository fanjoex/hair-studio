"""
Rotas para o painel do cliente:
- Registro / login (role=client)
- Histórico de gerações de IA
- Agendamentos do cliente
"""

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime, timezone
from bson import ObjectId
import logging

client_router = APIRouter(prefix="/api")
db = None


def set_client_db(database):
    global db
    db = database


# ===== MODELS =====

class ClientRegister(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: Optional[str] = None
    barbershop_id: Optional[str] = None  # Optional: link to a barbershop on signup


class ClientProfile(BaseModel):
    id: str
    name: str
    email: str
    phone: Optional[str] = None
    barbershop_id: Optional[str] = None
    barbershop_name: Optional[str] = None


# ===== HELPERS =====

async def get_current_client(request: Request) -> dict:
    """Get current authenticated user and require role=client."""
    from server import get_current_user
    user = await get_current_user(request)
    if user.get("role") != "client":
        raise HTTPException(status_code=403, detail="Acesso restrito a clientes")
    return user


# ===== AUTH =====

@client_router.post("/auth/register-client")
async def register_client(data: ClientRegister, response: Response):
    """Register a new client user. Optionally link to a barbershop."""
    try:
        from server import hash_password, create_access_token, create_refresh_token, set_auth_cookies

        email = data.email.lower()
        existing = await db.users.find_one({"email": email})
        if existing:
            raise HTTPException(status_code=400, detail="E-mail já cadastrado")

        # If barbershop_id provided, validate it exists
        barbershop_name = None
        if data.barbershop_id:
            bshop = await db.barbershops.find_one({"id": data.barbershop_id, "status": "active"})
            if not bshop:
                raise HTTPException(status_code=404, detail="Barbearia não encontrada")
            barbershop_name = bshop["name"]

        user_id = str(ObjectId())
        user_doc = {
            "_id": ObjectId(user_id),
            "name": data.name,
            "email": email,
            "phone": data.phone,
            "password_hash": hash_password(data.password),
            "role": "client",
            "barbershop_id": data.barbershop_id,
            "favorites": [],
            "created_at": datetime.now(timezone.utc),
        }
        await db.users.insert_one(user_doc)

        # Try to link to existing client record (by phone or email) in barbershop
        if data.barbershop_id and (data.phone or email):
            query = {"barbershop_id": data.barbershop_id, "$or": []}
            if data.phone:
                query["$or"].append({"phone": data.phone})
            if email:
                query["$or"].append({"email": email})
            if query["$or"]:
                existing_client = await db.clients.find_one(query)
                if existing_client:
                    await db.clients.update_one(
                        {"_id": existing_client["_id"]},
                        {"$set": {"user_id": user_id}}
                    )

        access_token = create_access_token(user_id, email)
        refresh_token = create_refresh_token(user_id)
        set_auth_cookies(response, access_token, refresh_token)

        return {
            "id": user_id,
            "name": data.name,
            "email": email,
            "role": "client",
            "favorites": [],
            "barbershop_id": data.barbershop_id,
            "barbershop_name": barbershop_name,
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error registering client: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== CLIENT DATA =====

@client_router.get("/client/me")
async def get_client_profile(request: Request):
    """Return current client profile + barbershop info."""
    user = await get_current_client(request)
    barbershop_name = None
    barbershop_id = user.get("barbershop_id")
    if barbershop_id:
        bshop = await db.barbershops.find_one({"id": barbershop_id})
        if bshop:
            barbershop_name = bshop.get("name")
    return {
        "id": user["_id"],
        "name": user["name"],
        "email": user["email"],
        "phone": user.get("phone"),
        "barbershop_id": barbershop_id,
        "barbershop_name": barbershop_name,
    }


@client_router.get("/client/ai-history")
async def get_client_ai_history(request: Request):
    """List the client's AI style generations."""
    user = await get_current_client(request)
    user_id = user["_id"]

    results = await db.client_ai_results.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)

    return results


@client_router.get("/client/appointments")
async def get_client_appointments(request: Request):
    """List the client's appointments (past and future)."""
    user = await get_current_client(request)
    user_id = user["_id"]
    phone = user.get("phone")
    email = user.get("email")

    # Find client records linked to this user (by user_id, phone or email)
    or_filters = [{"user_id": user_id}]
    if phone:
        or_filters.append({"phone": phone})
    if email:
        or_filters.append({"email": email})

    client_records = await db.clients.find(
        {"$or": or_filters},
        {"_id": 0, "id": 1, "barbershop_id": 1}
    ).to_list(50)
    client_ids = [c["id"] for c in client_records]

    if not client_ids:
        return []

    appointments = await db.appointments.find(
        {"client_id": {"$in": client_ids}},
        {"_id": 0}
    ).sort("date", -1).to_list(200)

    # Enrich with barbershop name and service name
    bshop_ids = list({a.get("barbershop_id") for a in appointments if a.get("barbershop_id")})
    bshops = {}
    if bshop_ids:
        async for b in db.barbershops.find({"id": {"$in": bshop_ids}}, {"_id": 0, "id": 1, "name": 1}):
            bshops[b["id"]] = b.get("name")

    service_ids = list({a.get("service_id") for a in appointments if a.get("service_id")})
    services = {}
    if service_ids:
        async for s in db.services.find({"id": {"$in": service_ids}}, {"_id": 0, "id": 1, "name": 1, "price": 1}):
            services[s["id"]] = s

    for a in appointments:
        a["barbershop_name"] = bshops.get(a.get("barbershop_id"))
        svc = services.get(a.get("service_id"))
        if svc:
            a["service_name"] = svc.get("name")
            a["service_price"] = svc.get("price")

    return appointments

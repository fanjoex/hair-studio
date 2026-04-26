"""
Rotas para gerenciamento de barbearias, clientes e serviços.
Seguindo o padrão do server.py existente.
"""

from fastapi import APIRouter, HTTPException, Request, Depends
from typing import List
from datetime import datetime, timezone
from bson import ObjectId
import logging

# Imports dos models
from barbershop_models import (
    Barbershop, BarbershopCreate, BarbershopUpdate, BarbershopResponse,
    Client, ClientCreate, ClientUpdate, ClientResponse,
    Service, ServiceCreate, ServiceUpdate, ServiceResponse,
    MasterStats, BarbershopDashboardStats
)

# Router principal
barbershop_router = APIRouter(prefix="/api")

# Database será injetado do server.py
db = None

def set_db(database):
    """Função para injetar database instance."""
    global db
    db = database


# ===== HELPERS DE AUTORIZAÇÃO =====

async def get_current_user_from_request(request: Request) -> dict:
    """
    Reutiliza a função get_current_user do server.py.
    Será importada e injetada.
    """
    from server import get_current_user
    return await get_current_user(request)


async def require_master_admin(request: Request) -> dict:
    """Middleware que exige role master_admin."""
    user = await get_current_user_from_request(request)
    if user.get("role") != "master_admin":
        raise HTTPException(status_code=403, detail="Master admin access required")
    return user


async def require_barbershop_access(request: Request) -> tuple:
    """
    Middleware que exige acesso a uma barbearia.
    Retorna (user, barbershop_id).
    """
    user = await get_current_user_from_request(request)
    
    # Master admin pode acessar qualquer barbearia
    if user.get("role") == "master_admin":
        return user, None
    
    # Barbershop owner/staff deve ter barbershop_id
    if user.get("role") in ["barbershop_owner", "barbershop_staff"]:
        barbershop_id = user.get("barbershop_id")
        if not barbershop_id:
            raise HTTPException(status_code=403, detail="User not associated with any barbershop")
        return user, barbershop_id
    
    raise HTTPException(status_code=403, detail="Barbershop access required")


# ===== MASTER ADMIN ROUTES =====

@barbershop_router.get("/master/stats", response_model=MasterStats)
async def get_master_stats(request: Request, user: dict = Depends(require_master_admin)):
    """
    Estatísticas gerais da plataforma.
    Apenas master admin.
    """
    try:
        # Contar barbearias por status
        total_barbershops = await db.barbershops.count_documents({})
        active_barbershops = await db.barbershops.count_documents({"status": "active"})
        pending_barbershops = await db.barbershops.count_documents({"status": "pending"})
        inactive_barbershops = await db.barbershops.count_documents({"status": "inactive"})
        
        # Contar totais
        total_clients = await db.clients.count_documents({})
        total_services = await db.services.count_documents({})
        total_users = await db.users.count_documents({})
        
        return MasterStats(
            total_barbershops=total_barbershops,
            active_barbershops=active_barbershops,
            pending_barbershops=pending_barbershops,
            inactive_barbershops=inactive_barbershops,
            total_clients=total_clients,
            total_services=total_services,
            total_users=total_users
        )
    except Exception as e:
        logging.error(f"Error getting master stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@barbershop_router.get("/master/barbershops", response_model=List[BarbershopResponse])
async def list_all_barbershops(request: Request, user: dict = Depends(require_master_admin)):
    """
    Listar todas as barbearias.
    Apenas master admin.
    """
    try:
        barbershops = await db.barbershops.find({}, {"_id": 0}).to_list(100)
        
        # Enriquecer com contagens
        result = []
        for b in barbershops:
            total_clients = await db.clients.count_documents({"barbershop_id": b["id"]})
            total_services = await db.services.count_documents({"barbershop_id": b["id"]})
            
            # Converter datetime strings
            if isinstance(b.get('created_at'), str):
                b['created_at'] = datetime.fromisoformat(b['created_at'])
            
            response = BarbershopResponse(**b)
            response.total_clients = total_clients
            response.total_services = total_services
            result.append(response)
        
        return result
    except Exception as e:
        logging.error(f"Error listing barbershops: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@barbershop_router.post("/master/barbershops", response_model=BarbershopResponse)
async def create_barbershop(
    barbershop_data: BarbershopCreate,
    request: Request,
    user: dict = Depends(require_master_admin)
):
    """
    Criar nova barbearia.
    Apenas master admin.
    """
    try:
        # Verificar se email já existe
        existing = await db.barbershops.find_one({"email": barbershop_data.email.lower()})
        if existing:
            raise HTTPException(status_code=400, detail="Barbershop with this email already exists")
        
        # Criar owner se email foi fornecido
        owner_id = None
        if barbershop_data.owner_email:
            # Verificar se usuário já existe
            owner = await db.users.find_one({"email": barbershop_data.owner_email.lower()})
            
            if not owner:
                # Criar novo usuário barbershop_owner
                from server import hash_password
                
                owner_id = str(ObjectId())
                owner_doc = {
                    "_id": ObjectId(owner_id),
                    "name": barbershop_data.name,  # Nome da barbearia como nome inicial
                    "email": barbershop_data.owner_email.lower(),
                    "password_hash": hash_password("mudar123"),  # Senha padrão
                    "role": "barbershop_owner",
                    "favorites": [],
                    "created_at": datetime.now(timezone.utc)
                }
                await db.users.insert_one(owner_doc)
            else:
                owner_id = str(owner["_id"])
        
        # Criar barbearia
        barbershop = Barbershop(
            name=barbershop_data.name,
            document=barbershop_data.document,
            phone=barbershop_data.phone,
            email=barbershop_data.email.lower(),
            address=barbershop_data.address,
            owner_id=owner_id,
            status="active"
        )
        
        barbershop_dict = barbershop.model_dump()
        barbershop_dict['created_at'] = barbershop_dict['created_at'].isoformat()
        barbershop_dict['updated_at'] = barbershop_dict['updated_at'].isoformat()
        
        if barbershop_dict['subscription']['expires_at']:
            barbershop_dict['subscription']['expires_at'] = barbershop_dict['subscription']['expires_at'].isoformat()
        
        await db.barbershops.insert_one(barbershop_dict)
        
        # Atualizar user com barbershop_id
        if owner_id:
            await db.users.update_one(
                {"_id": ObjectId(owner_id)},
                {"$set": {"barbershop_id": barbershop.id}}
            )
        
        response = BarbershopResponse(**barbershop.model_dump())
        response.total_clients = 0
        response.total_services = 0
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error creating barbershop: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@barbershop_router.get("/master/barbershops/{barbershop_id}", response_model=BarbershopResponse)
async def get_barbershop(
    barbershop_id: str,
    request: Request,
    user: dict = Depends(require_master_admin)
):
    """
    Buscar barbearia por ID.
    Apenas master admin.
    """
    try:
        barbershop = await db.barbershops.find_one({"id": barbershop_id}, {"_id": 0})
        if not barbershop:
            raise HTTPException(status_code=404, detail="Barbershop not found")
        
        # Contagens
        total_clients = await db.clients.count_documents({"barbershop_id": barbershop_id})
        total_services = await db.services.count_documents({"barbershop_id": barbershop_id})
        
        if isinstance(barbershop.get('created_at'), str):
            barbershop['created_at'] = datetime.fromisoformat(barbershop['created_at'])
        
        response = BarbershopResponse(**barbershop)
        response.total_clients = total_clients
        response.total_services = total_services
        
        return response
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting barbershop: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@barbershop_router.put("/master/barbershops/{barbershop_id}", response_model=BarbershopResponse)
async def update_barbershop(
    barbershop_id: str,
    update_data: BarbershopUpdate,
    request: Request,
    user: dict = Depends(require_master_admin)
):
    """
    Atualizar barbearia.
    Apenas master admin.
    """
    try:
        barbershop = await db.barbershops.find_one({"id": barbershop_id})
        if not barbershop:
            raise HTTPException(status_code=404, detail="Barbershop not found")
        
        # Preparar update
        update_dict = update_data.model_dump(exclude_unset=True)
        if update_dict:
            update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
            await db.barbershops.update_one(
                {"id": barbershop_id},
                {"$set": update_dict}
            )
        
        # Buscar atualizado
        updated = await db.barbershops.find_one({"id": barbershop_id}, {"_id": 0})
        
        if isinstance(updated.get('created_at'), str):
            updated['created_at'] = datetime.fromisoformat(updated['created_at'])
        
        total_clients = await db.clients.count_documents({"barbershop_id": barbershop_id})
        total_services = await db.services.count_documents({"barbershop_id": barbershop_id})
        
        response = BarbershopResponse(**updated)
        response.total_clients = total_clients
        response.total_services = total_services
        
        return response
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating barbershop: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@barbershop_router.delete("/master/barbershops/{barbershop_id}")
async def delete_barbershop(
    barbershop_id: str,
    request: Request,
    user: dict = Depends(require_master_admin)
):
    """
    Deletar barbearia (soft delete - marca como inactive).
    Apenas master admin.
    """
    try:
        barbershop = await db.barbershops.find_one({"id": barbershop_id})
        if not barbershop:
            raise HTTPException(status_code=404, detail="Barbershop not found")
        
        # Soft delete
        await db.barbershops.update_one(
            {"id": barbershop_id},
            {"$set": {"status": "inactive", "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        return {"message": "Barbershop deactivated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting barbershop: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== BARBERSHOP ROUTES (Owner/Staff) =====

@barbershop_router.get("/barbershop/dashboard", response_model=BarbershopDashboardStats)
async def get_barbershop_dashboard(request: Request):
    """Dashboard da barbearia do owner logado."""
    try:
        user, barbershop_id = await require_barbershop_access(request)
        
        if not barbershop_id:
            raise HTTPException(status_code=400, detail="Barbershop ID required")
        
        barbershop = await db.barbershops.find_one({"id": barbershop_id}, {"_id": 0})
        if not barbershop:
            raise HTTPException(status_code=404, detail="Barbershop not found")
        
        total_clients = await db.clients.count_documents({"barbershop_id": barbershop_id})
        total_services = await db.services.count_documents({"barbershop_id": barbershop_id})
        active_services = await db.services.count_documents({"barbershop_id": barbershop_id, "active": True})
        inactive_services = total_services - active_services
        
        return BarbershopDashboardStats(
            barbershop_name=barbershop["name"],
            total_clients=total_clients,
            total_services=total_services,
            active_services=active_services,
            inactive_services=inactive_services,
        )
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting barbershop dashboard: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@barbershop_router.get("/barbershop/financial-report")
async def get_financial_report(request: Request, period: str = "month"):
    """Relatório financeiro da barbearia. period: today, week, month, year"""
    try:
        user, barbershop_id = await require_barbershop_access(request)
        if not barbershop_id:
            raise HTTPException(status_code=400, detail="Barbershop ID required")

        from datetime import timedelta

        now = datetime.now(timezone.utc)
        if period == "today":
            start_date = now.strftime("%Y-%m-%d")
            end_date = start_date
        elif period == "week":
            start = now - timedelta(days=now.weekday())
            start_date = start.strftime("%Y-%m-%d")
            end_date = now.strftime("%Y-%m-%d")
        elif period == "year":
            start_date = f"{now.year}-01-01"
            end_date = now.strftime("%Y-%m-%d")
        else:  # month
            start_date = f"{now.year}-{now.month:02d}-01"
            end_date = now.strftime("%Y-%m-%d")

        # All appointments in period
        apts = await db.appointments.find(
            {"barbershop_id": barbershop_id, "date": {"$gte": start_date, "$lte": end_date}},
            {"_id": 0}
        ).to_list(5000)

        completed = [a for a in apts if a.get("status") == "completed"]
        cancelled = [a for a in apts if a.get("status") == "cancelled"]
        no_show = [a for a in apts if a.get("status") == "no_show"]
        scheduled = [a for a in apts if a.get("status") == "scheduled"]

        revenue = sum(a.get("price", 0) for a in completed)
        potential_revenue = sum(a.get("price", 0) for a in apts if a.get("status") != "cancelled")
        avg_ticket = revenue / len(completed) if completed else 0

        # Services ranking
        service_counts = {}
        for a in completed:
            sname = a.get("service_name", "Outros")
            if sname not in service_counts:
                service_counts[sname] = {"count": 0, "revenue": 0}
            service_counts[sname]["count"] += 1
            service_counts[sname]["revenue"] += a.get("price", 0)
        top_services = sorted(service_counts.items(), key=lambda x: x[1]["revenue"], reverse=True)[:5]

        # Professional ranking
        pro_counts = {}
        for a in completed:
            pname = a.get("professional_name", "Outros")
            if pname not in pro_counts:
                pro_counts[pname] = {"count": 0, "revenue": 0}
            pro_counts[pname]["count"] += 1
            pro_counts[pname]["revenue"] += a.get("price", 0)
        top_professionals = sorted(pro_counts.items(), key=lambda x: x[1]["revenue"], reverse=True)[:5]

        # Revenue by day (for chart)
        daily_revenue = {}
        for a in completed:
            d = a.get("date", "")
            if d not in daily_revenue:
                daily_revenue[d] = 0
            daily_revenue[d] += a.get("price", 0)

        return {
            "period": period,
            "start_date": start_date,
            "end_date": end_date,
            "total_appointments": len(apts),
            "completed": len(completed),
            "cancelled": len(cancelled),
            "no_show": len(no_show),
            "scheduled": len(scheduled),
            "revenue": round(revenue, 2),
            "potential_revenue": round(potential_revenue, 2),
            "avg_ticket": round(avg_ticket, 2),
            "completion_rate": round(len(completed) / len(apts) * 100, 1) if apts else 0,
            "top_services": [{"name": name, **data} for name, data in top_services],
            "top_professionals": [{"name": name, **data} for name, data in top_professionals],
            "daily_revenue": [{"date": d, "revenue": r} for d, r in sorted(daily_revenue.items())],
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting financial report: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@barbershop_router.get("/barbershop/clients", response_model=List[ClientResponse])
async def list_clients(request: Request):
    """
    Listar clientes da barbearia.
    Requer acesso a barbearia.
    """
    try:
        user, barbershop_id = await require_barbershop_access(request)
        
        # Se for master admin, pode filtrar por query param
        if user.get("role") == "master_admin" and not barbershop_id:
            # TODO: Implementar filtro por query param
            raise HTTPException(status_code=400, detail="Barbershop ID required for listing clients")
        
        clients = await db.clients.find(
            {"barbershop_id": barbershop_id},
            {"_id": 0}
        ).sort("created_at", -1).to_list(1000)
        
        result = []
        for c in clients:
            if isinstance(c.get('created_at'), str):
                c['created_at'] = datetime.fromisoformat(c['created_at'])
            result.append(ClientResponse(**c))
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error listing clients: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@barbershop_router.post("/barbershop/clients", response_model=ClientResponse)
async def create_client(client_data: ClientCreate, request: Request):
    """
    Criar novo cliente.
    Requer acesso a barbearia.
    """
    try:
        user, barbershop_id = await require_barbershop_access(request)
        
        if not barbershop_id:
            raise HTTPException(status_code=400, detail="Barbershop ID required")
        
        # Verificar se já existe cliente com mesmo telefone nesta barbearia
        existing = await db.clients.find_one({
            "barbershop_id": barbershop_id,
            "phone": client_data.phone
        })
        
        if existing:
            raise HTTPException(status_code=400, detail="Client with this phone already exists in this barbershop")
        
        client = Client(
            barbershop_id=barbershop_id,
            name=client_data.name,
            phone=client_data.phone,
            email=client_data.email,
            notes=client_data.notes
        )
        
        client_dict = client.model_dump()
        client_dict['created_at'] = client_dict['created_at'].isoformat()
        client_dict['updated_at'] = client_dict['updated_at'].isoformat()
        
        await db.clients.insert_one(client_dict)
        
        return ClientResponse(**client.model_dump())
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error creating client: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@barbershop_router.get("/barbershop/clients/{client_id}", response_model=ClientResponse)
async def get_client(client_id: str, request: Request):
    """Buscar cliente por ID."""
    try:
        user, barbershop_id = await require_barbershop_access(request)
        
        query = {"id": client_id}
        if barbershop_id:
            query["barbershop_id"] = barbershop_id
        
        client = await db.clients.find_one(query, {"_id": 0})
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        
        if isinstance(client.get('created_at'), str):
            client['created_at'] = datetime.fromisoformat(client['created_at'])
        
        return ClientResponse(**client)
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting client: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@barbershop_router.put("/barbershop/clients/{client_id}", response_model=ClientResponse)
async def update_client(client_id: str, update_data: ClientUpdate, request: Request):
    """Atualizar cliente."""
    try:
        user, barbershop_id = await require_barbershop_access(request)
        
        query = {"id": client_id}
        if barbershop_id:
            query["barbershop_id"] = barbershop_id
        
        client = await db.clients.find_one(query)
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        
        update_dict = update_data.model_dump(exclude_unset=True)
        if update_dict:
            update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
            await db.clients.update_one({"id": client_id}, {"$set": update_dict})
        
        updated = await db.clients.find_one({"id": client_id}, {"_id": 0})
        
        if isinstance(updated.get('created_at'), str):
            updated['created_at'] = datetime.fromisoformat(updated['created_at'])
        
        return ClientResponse(**updated)
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating client: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@barbershop_router.delete("/barbershop/clients/{client_id}")
async def delete_client(client_id: str, request: Request):
    """Deletar cliente."""
    try:
        user, barbershop_id = await require_barbershop_access(request)
        
        query = {"id": client_id}
        if barbershop_id:
            query["barbershop_id"] = barbershop_id
        
        result = await db.clients.delete_one(query)
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Client not found")
        
        return {"message": "Client deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting client: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@barbershop_router.get("/barbershop/clients/{client_id}/history")
async def get_client_history(client_id: str, request: Request):
    """Histórico de atendimentos de um cliente."""
    try:
        user, barbershop_id = await require_barbershop_access(request)

        query = {"id": client_id}
        if barbershop_id:
            query["barbershop_id"] = barbershop_id

        client = await db.clients.find_one(query, {"_id": 0})
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")

        # Match by client_id or by name+phone
        apt_query = {"barbershop_id": client["barbershop_id"]}
        apt_query["$or"] = [
            {"client_id": client_id},
            {"client_name": client["name"], "client_phone": client["phone"]},
        ]

        appointments = await db.appointments.find(
            apt_query, {"_id": 0}
        ).sort("date", -1).to_list(500)

        completed = [a for a in appointments if a.get("status") == "completed"]
        total_spent = sum(a.get("price", 0) for a in completed)
        total_visits = len(completed)

        return {
            "client": {
                "id": client["id"],
                "name": client["name"],
                "phone": client["phone"],
                "email": client.get("email"),
            },
            "total_visits": total_visits,
            "total_spent": round(total_spent, 2),
            "appointments": [
                {
                    "id": a["id"],
                    "date": a.get("date", ""),
                    "start_time": a.get("start_time", ""),
                    "service_name": a.get("service_name", ""),
                    "professional_name": a.get("professional_name", ""),
                    "price": a.get("price", 0),
                    "status": a.get("status", ""),
                    "duration_minutes": a.get("duration_minutes", 0),
                }
                for a in appointments
            ],
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting client history: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== SERVICE ROUTES =====

@barbershop_router.get("/barbershop/services", response_model=List[ServiceResponse])
async def list_services(request: Request):
    """Listar serviços da barbearia."""
    try:
        user, barbershop_id = await require_barbershop_access(request)
        
        if not barbershop_id:
            raise HTTPException(status_code=400, detail="Barbershop ID required")
        
        services = await db.services.find(
            {"barbershop_id": barbershop_id},
            {"_id": 0}
        ).sort("name", 1).to_list(1000)
        
        result = []
        for s in services:
            if isinstance(s.get('created_at'), str):
                s['created_at'] = datetime.fromisoformat(s['created_at'])
            result.append(ServiceResponse(**s))
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error listing services: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@barbershop_router.post("/barbershop/services", response_model=ServiceResponse)
async def create_service(service_data: ServiceCreate, request: Request):
    """Criar novo serviço."""
    try:
        user, barbershop_id = await require_barbershop_access(request)
        
        if not barbershop_id:
            raise HTTPException(status_code=400, detail="Barbershop ID required")
        
        service = Service(
            barbershop_id=barbershop_id,
            name=service_data.name,
            description=service_data.description,
            duration_minutes=service_data.duration_minutes,
            price=service_data.price,
            category=service_data.category
        )
        
        service_dict = service.model_dump()
        service_dict['created_at'] = service_dict['created_at'].isoformat()
        service_dict['updated_at'] = service_dict['updated_at'].isoformat()
        
        await db.services.insert_one(service_dict)
        
        return ServiceResponse(**service.model_dump())
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error creating service: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@barbershop_router.get("/barbershop/services/{service_id}", response_model=ServiceResponse)
async def get_service(service_id: str, request: Request):
    """Buscar serviço por ID."""
    try:
        user, barbershop_id = await require_barbershop_access(request)
        
        query = {"id": service_id}
        if barbershop_id:
            query["barbershop_id"] = barbershop_id
        
        service = await db.services.find_one(query, {"_id": 0})
        if not service:
            raise HTTPException(status_code=404, detail="Service not found")
        
        if isinstance(service.get('created_at'), str):
            service['created_at'] = datetime.fromisoformat(service['created_at'])
        
        return ServiceResponse(**service)
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting service: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@barbershop_router.put("/barbershop/services/{service_id}", response_model=ServiceResponse)
async def update_service(service_id: str, update_data: ServiceUpdate, request: Request):
    """Atualizar serviço."""
    try:
        user, barbershop_id = await require_barbershop_access(request)
        
        query = {"id": service_id}
        if barbershop_id:
            query["barbershop_id"] = barbershop_id
        
        service = await db.services.find_one(query)
        if not service:
            raise HTTPException(status_code=404, detail="Service not found")
        
        update_dict = update_data.model_dump(exclude_unset=True)
        if update_dict:
            update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
            await db.services.update_one({"id": service_id}, {"$set": update_dict})
        
        updated = await db.services.find_one({"id": service_id}, {"_id": 0})
        
        if isinstance(updated.get('created_at'), str):
            updated['created_at'] = datetime.fromisoformat(updated['created_at'])
        
        return ServiceResponse(**updated)
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating service: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@barbershop_router.delete("/barbershop/services/{service_id}")
async def delete_service(service_id: str, request: Request):
    """Deletar serviço."""
    try:
        user, barbershop_id = await require_barbershop_access(request)
        
        query = {"id": service_id}
        if barbershop_id:
            query["barbershop_id"] = barbershop_id
        
        result = await db.services.delete_one(query)
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Service not found")
        
        return {"message": "Service deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting service: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

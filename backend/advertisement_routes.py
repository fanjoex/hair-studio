"""
Rotas para gerenciamento de propagandas.
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from typing import Optional, List
from datetime import datetime, timezone
import logging

from advertisement_models import Advertisement, AdvertisementCreate, AdvertisementUpdate

advertisement_router = APIRouter(prefix="/api/advertisements", tags=["advertisements"])
logger = logging.getLogger(__name__)

db = None

def set_advertisement_db(database):
    global db
    db = database


# ===== PLAN LIMITS =====
# Limite de propagandas próprias por plano da barbearia
PLAN_LIMITS = {
    "free": 0,        # Grátis: só vê propagandas globais do admin
    "basic": 4,       # Básico: até 4 propagandas próprias
    "premium": -1,    # Premium: ilimitado (-1)
}


async def _get_barbershop_plan(barbershop_id: str) -> str:
    """Retorna o plano atual da barbearia (default: free)."""
    barbershop = await db.barbershops.find_one({"id": barbershop_id})
    if not barbershop:
        return "free"
    return (barbershop.get("subscription") or {}).get("plan", "free")


async def _check_plan_allows_custom_ad(barbershop_id: str) -> tuple:
    """
    Verifica se a barbearia pode criar mais uma propaganda.
    Retorna (allowed: bool, plan: str, limit: int, current: int).
    """
    plan = await _get_barbershop_plan(barbershop_id)
    limit = PLAN_LIMITS.get(plan, 0)
    current = await db.advertisements.count_documents({"barbershop_id": barbershop_id})
    if limit == -1:
        return True, plan, limit, current
    return current < limit, plan, limit, current


def _get_auth_deps():
    from barbershop_routes import require_master_admin, require_barbershop_access
    return require_master_admin, require_barbershop_access


@advertisement_router.get("/public/{barbershop_id}")
async def get_public_advertisements(barbershop_id: str):
    """
    Buscar propagandas para página pública da barbearia.
    Regra:
    - Plano PREMIUM ou BASIC: exibe apenas as próprias propagandas da barbearia (se houver)
    - Plano FREE (ou sem propagandas próprias): exibe as globais do admin
    """
    try:
        barbershop = await db.barbershops.find_one({"id": barbershop_id})
        if not barbershop:
            raise HTTPException(status_code=404, detail="Barbershop not found")

        plan = (barbershop.get("subscription") or {}).get("plan", "free")

        # Planos pagos: priorizar propagandas próprias
        if plan in ("basic", "premium"):
            custom_ads = await db.advertisements.find(
                {"barbershop_id": barbershop_id, "is_active": True}
            ).sort("created_at", -1).to_list(length=100)

            if custom_ads:
                return [{"id": ad["id"], "name": ad["name"], "brand": ad["brand"],
                         "price": ad["price"], "description": ad["description"],
                         "image_url": ad.get("image_url"), "affiliate_url": ad["affiliate_url"],
                         "is_custom": True} for ad in custom_ads]

        # Fallback: propagandas globais do admin (plano free ou sem custom)
        global_ads = await db.advertisements.find(
            {"barbershop_id": None, "is_active": True}
        ).sort("created_at", -1).to_list(length=100)

        return [{"id": ad["id"], "name": ad["name"], "brand": ad["brand"],
                 "price": ad["price"], "description": ad["description"],
                 "image_url": ad.get("image_url"), "affiliate_url": ad["affiliate_url"],
                 "is_custom": False} for ad in global_ads]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching advertisements: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@advertisement_router.get("/barbershop")
async def get_barbershop_advertisements(request: Request):
    """Buscar propagandas da barbearia logada."""
    from barbershop_routes import require_barbershop_access
    user, barbershop_id = await require_barbershop_access(request)
    try:
        global_ads = await db.advertisements.find(
            {"barbershop_id": None, "is_active": True}
        ).to_list(length=50)
        custom_ads = await db.advertisements.find(
            {"barbershop_id": barbershop_id}
        ).to_list(length=50)

        # Info do plano
        plan = await _get_barbershop_plan(barbershop_id)
        limit = PLAN_LIMITS.get(plan, 0)

        return {
            "global": [{"id": ad["id"], "name": ad["name"], "brand": ad["brand"],
                        "price": ad["price"], "description": ad["description"],
                        "image_url": ad.get("image_url"), "affiliate_url": ad["affiliate_url"],
                        "is_active": ad["is_active"]} for ad in global_ads],
            "custom": [{"id": ad["id"], "name": ad["name"], "brand": ad["brand"],
                        "price": ad["price"], "description": ad["description"],
                        "image_url": ad.get("image_url"), "affiliate_url": ad["affiliate_url"],
                        "is_active": ad["is_active"]} for ad in custom_ads],
            "plan": {
                "name": plan,
                "limit": limit,  # -1 = ilimitado
                "current": len(custom_ads),
                "can_create": limit == -1 or len(custom_ads) < limit,
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching barbershop advertisements: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@advertisement_router.post("/barbershop")
async def create_barbershop_advertisement(request: Request, data: AdvertisementCreate):
    """Criar propaganda própria da barbearia."""
    from barbershop_routes import require_barbershop_access
    user, barbershop_id = await require_barbershop_access(request)
    try:
        # Validar limite do plano
        allowed, plan, limit, current = await _check_plan_allows_custom_ad(barbershop_id)
        if not allowed:
            if limit == 0:
                detail = f"Seu plano atual ({plan}) não permite criar propagandas próprias. Faça upgrade para adicionar produtos."
            else:
                detail = f"Limite do plano {plan} atingido ({current}/{limit} propagandas). Faça upgrade para criar mais."
            raise HTTPException(status_code=403, detail=detail)

        ad = Advertisement(**data.model_dump(), barbershop_id=barbershop_id)
        ad_dict = ad.model_dump()
        ad_dict['created_at'] = ad_dict['created_at'].isoformat()
        ad_dict['updated_at'] = ad_dict['updated_at'].isoformat()
        await db.advertisements.insert_one(ad_dict)
        return {"id": ad.id, "message": "Advertisement created successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating advertisement: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@advertisement_router.put("/barbershop/{ad_id}")
async def update_barbershop_advertisement(ad_id: str, request: Request, data: AdvertisementUpdate):
    """Atualizar propaganda própria da barbearia."""
    from barbershop_routes import require_barbershop_access
    user, barbershop_id = await require_barbershop_access(request)
    try:
        existing = await db.advertisements.find_one({"id": ad_id, "barbershop_id": barbershop_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Advertisement not found")
        update_data = {k: v for k, v in data.model_dump().items() if v is not None}
        update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
        await db.advertisements.update_one({"id": ad_id}, {"$set": update_data})
        return {"message": "Advertisement updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating advertisement: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@advertisement_router.delete("/barbershop/{ad_id}")
async def delete_barbershop_advertisement(ad_id: str, request: Request):
    """Deletar propaganda própria da barbearia."""
    from barbershop_routes import require_barbershop_access
    user, barbershop_id = await require_barbershop_access(request)
    try:
        result = await db.advertisements.delete_one({"id": ad_id, "barbershop_id": barbershop_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Advertisement not found")
        return {"message": "Advertisement deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting advertisement: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== PLAN MANAGEMENT (MASTER ADMIN) =====

@advertisement_router.put("/admin/barbershops/{barbershop_id}/plan")
async def update_barbershop_plan(barbershop_id: str, request: Request, body: dict):
    """Atualizar plano de assinatura de uma barbearia (apenas master admin)."""
    from barbershop_routes import require_master_admin
    await require_master_admin(request)
    try:
        new_plan = (body or {}).get("plan", "").lower()
        if new_plan not in PLAN_LIMITS:
            raise HTTPException(status_code=400, detail=f"Plano inválido. Use: {', '.join(PLAN_LIMITS.keys())}")

        barbershop = await db.barbershops.find_one({"id": barbershop_id})
        if not barbershop:
            raise HTTPException(status_code=404, detail="Barbearia não encontrada")

        await db.barbershops.update_one(
            {"id": barbershop_id},
            {"$set": {"subscription.plan": new_plan, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        return {"message": "Plano atualizado", "plan": new_plan}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating plan: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== MASTER ADMIN ROUTES =====

@advertisement_router.get("/admin/all")
async def get_all_advertisements_admin(request: Request):
    """Buscar todas propagandas (apenas master admin)."""
    from barbershop_routes import require_master_admin
    await require_master_admin(request)
    try:
        cursor = db.advertisements.find().sort("created_at", -1)
        ads = await cursor.to_list(length=100)
        return [{"id": ad["id"], "name": ad["name"], "brand": ad["brand"],
                 "price": ad["price"], "description": ad["description"],
                 "image_url": ad.get("image_url"), "affiliate_url": ad["affiliate_url"],
                 "barbershop_id": ad.get("barbershop_id"), "is_active": ad["is_active"]} for ad in ads]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching all advertisements: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@advertisement_router.post("/admin")
async def create_global_advertisement(request: Request, data: AdvertisementCreate):
    """Criar propaganda global (apenas master admin)."""
    from barbershop_routes import require_master_admin
    await require_master_admin(request)
    try:
        ad = Advertisement(**data.model_dump())
        ad_dict = ad.model_dump()
        ad_dict['created_at'] = ad_dict['created_at'].isoformat()
        ad_dict['updated_at'] = ad_dict['updated_at'].isoformat()
        await db.advertisements.insert_one(ad_dict)
        return {"id": ad.id, "message": "Global advertisement created successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating global advertisement: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@advertisement_router.put("/admin/{ad_id}")
async def update_global_advertisement(ad_id: str, request: Request, data: AdvertisementUpdate):
    """Atualizar propaganda global (apenas master admin)."""
    from barbershop_routes import require_master_admin
    await require_master_admin(request)
    try:
        existing = await db.advertisements.find_one({"id": ad_id, "barbershop_id": None})
        if not existing:
            raise HTTPException(status_code=404, detail="Global advertisement not found")
        update_data = {k: v for k, v in data.model_dump().items() if v is not None}
        update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
        await db.advertisements.update_one({"id": ad_id}, {"$set": update_data})
        return {"message": "Global advertisement updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating global advertisement: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@advertisement_router.delete("/admin/{ad_id}")
async def delete_global_advertisement(ad_id: str, request: Request):
    """Deletar propaganda global (apenas master admin)."""
    from barbershop_routes import require_master_admin
    await require_master_admin(request)
    try:
        result = await db.advertisements.delete_one({"id": ad_id, "barbershop_id": None})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Global advertisement not found")
        return {"message": "Global advertisement deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting global advertisement: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

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


def _get_auth_deps():
    from server import require_master_admin, require_barbershop_owner
    return require_master_admin, require_barbershop_owner


@advertisement_router.get("/public/{barbershop_id}")
async def get_public_advertisements(barbershop_id: str):
    """
    Buscar propagandas para página pública da barbearia.
    Retorna: globais do admin + específicas da barbearia (se plano permitir).
    """
    try:
        # Buscar barbearia para verificar plano
        barbershop = await db.barbershops.find_one({"id": barbershop_id})
        if not barbershop:
            raise HTTPException(status_code=404, detail="Barbershop not found")
        
        # Build query: globais (barbershop_id=null) + específicas desta barbearia
        query = {
            "is_active": True,
            "$or": [
                {"barbershop_id": None},  # Globais do admin
                {"barbershop_id": barbershop_id}  # Específicas desta barbearia
            ]
        }
        
        cursor = db.advertisements.find(query).sort("created_at", -1)
        ads = await cursor.to_list(length=100)
        
        return [{"id": ad["id"], "name": ad["name"], "brand": ad["brand"],
                 "price": ad["price"], "description": ad["description"],
                 "image_url": ad.get("image_url"), "affiliate_url": ad["affiliate_url"],
                 "is_custom": ad.get("barbershop_id") is not None} for ad in ads]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching advertisements: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@advertisement_router.get("/barbershop")
async def get_barbershop_advertisements(request: Request):
    """Buscar propagandas da barbearia logada."""
    from server import require_barbershop_owner
    user = await require_barbershop_owner(request)
    try:
        barbershop_id = user.get("barbershop_id")
        global_ads = await db.advertisements.find(
            {"barbershop_id": None, "is_active": True}
        ).to_list(length=50)
        custom_ads = await db.advertisements.find(
            {"barbershop_id": barbershop_id}
        ).to_list(length=50)
        return {
            "global": [{"id": ad["id"], "name": ad["name"], "brand": ad["brand"],
                        "price": ad["price"], "description": ad["description"],
                        "image_url": ad.get("image_url"), "affiliate_url": ad["affiliate_url"],
                        "is_active": ad["is_active"]} for ad in global_ads],
            "custom": [{"id": ad["id"], "name": ad["name"], "brand": ad["brand"],
                        "price": ad["price"], "description": ad["description"],
                        "image_url": ad.get("image_url"), "affiliate_url": ad["affiliate_url"],
                        "is_active": ad["is_active"]} for ad in custom_ads]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching barbershop advertisements: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@advertisement_router.post("/barbershop")
async def create_barbershop_advertisement(request: Request, data: AdvertisementCreate):
    """Criar propaganda própria da barbearia."""
    from server import require_barbershop_owner
    user = await require_barbershop_owner(request)
    try:
        barbershop_id = user.get("barbershop_id")
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
    from server import require_barbershop_owner
    user = await require_barbershop_owner(request)
    try:
        barbershop_id = user.get("barbershop_id")
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
    from server import require_barbershop_owner
    user = await require_barbershop_owner(request)
    try:
        barbershop_id = user.get("barbershop_id")
        result = await db.advertisements.delete_one({"id": ad_id, "barbershop_id": barbershop_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Advertisement not found")
        return {"message": "Advertisement deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting advertisement: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== MASTER ADMIN ROUTES =====

@advertisement_router.get("/admin/all")
async def get_all_advertisements_admin(request: Request):
    """Buscar todas propagandas (apenas master admin)."""
    from server import require_master_admin
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
    from server import require_master_admin
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
    from server import require_master_admin
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
    from server import require_master_admin
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

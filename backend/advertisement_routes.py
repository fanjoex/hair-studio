"""
Rotas para gerenciamento de propagandas.
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from typing import Optional, List
from datetime import datetime, timezone
import logging
import re
import httpx

from advertisement_models import Advertisement, AdvertisementCreate, AdvertisementUpdate

advertisement_router = APIRouter(prefix="/api/advertisements", tags=["advertisements"])
logger = logging.getLogger(__name__)

db = None

def set_advertisement_db(database):
    global db
    db = database


def _get_auth_deps():
    from barbershop_routes import require_master_admin, require_barbershop_access
    return require_master_admin, require_barbershop_access


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
    from barbershop_routes import require_barbershop_access
    user, barbershop_id = await require_barbershop_access(request)
    try:
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
    from barbershop_routes import require_barbershop_access
    user, barbershop_id = await require_barbershop_access(request)
    try:
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


# ===== FETCH PRODUCT FROM URL =====

@advertisement_router.get("/fetch-product")
async def fetch_product_from_url(url: str):
    """
    Busca dados de produto a partir de um URL do Mercado Livre.
    Retorna name, brand, price, description, image_url, affiliate_url.
    """
    try:
        # Resolver URL encurtado seguindo redirects (GET, pois HEAD nem sempre redireciona)
        final_url = url
        try:
            async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
                resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
                final_url = str(resp.url)
        except Exception:
            final_url = url

        # Extrair ID do Mercado Livre (ex: MLB1234567890)
        ml_match = re.search(r'(MLB[-]?\d+)', final_url.upper().replace('%2F', '/'))
        
        if ml_match:
            item_id = ml_match.group(1).replace('-', '')
            async with httpx.AsyncClient(timeout=10) as client:
                # Buscar dados do item
                item_resp = await client.get(f"https://api.mercadolibre.com/items/{item_id}")
                if item_resp.status_code != 200:
                    raise HTTPException(status_code=404, detail="Produto não encontrado no Mercado Livre")
                
                item = item_resp.json()
                
                # Buscar atributos para marca
                brand = ""
                for attr in item.get("attributes", []):
                    if attr.get("id") == "BRAND":
                        brand = attr.get("value_name", "")
                        break
                
                # Buscar descrição
                desc = ""
                try:
                    desc_resp = await client.get(f"https://api.mercadolibre.com/items/{item_id}/description")
                    if desc_resp.status_code == 200:
                        desc = desc_resp.json().get("plain_text", "")[:200]
                except Exception:
                    pass
                
                # Formatar preço em BRL
                price = item.get("price", 0)
                price_str = f"R$ {price:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
                
                # Pegar melhor imagem
                pictures = item.get("pictures", [])
                image_url = ""
                if pictures:
                    image_url = pictures[0].get("url", item.get("thumbnail", ""))
                else:
                    image_url = item.get("thumbnail", "")
                # Usar imagem de maior resolução (substituir _I.jpg por _O.jpg)
                image_url = image_url.replace("_I.", "_O.").replace("-I.", "-O.")
                
                return {
                    "name": item.get("title", ""),
                    "brand": brand,
                    "price": price_str,
                    "description": desc,
                    "image_url": image_url,
                    "affiliate_url": url,
                    "source": "mercadolivre"
                }
        
        raise HTTPException(status_code=400, detail="URL não reconhecida. Suporte atual: Mercado Livre (MLB)")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching product from URL: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao buscar produto: {str(e)}")


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
